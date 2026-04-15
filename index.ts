#!/usr/bin/env bun

import { createOpenAI } from "@ai-sdk/openai";
import { generateText, isLoopFinished, tool, wrapLanguageModel, zodSchema } from "ai";
import { z } from "zod";
import type { ModelMessage } from "ai";
import { spawnSync } from "child_process";
import * as readline from "readline";

// May need to use other types of middleware for other models, like non-coder variants of Qwen
// Required for qwen3-coder to properly parse toolcalls
import { qwen3CoderToolMiddleware } from "@ai-sdk-tool/parser";
import { Qwen3Coder } from "./models";



/* CONSTANTS */
//const MODEL = "qwen3.5:35b-a3b"; // Waaaaay to slow, but the output is really good. Should look for a better matched version of this one for my machine.
const MODEL = "qwen3-coder:30b"; // actually surprisingly fast for the size, and the output is pretty good. Just need to resolve an issue with Toolcall parsing.

// TODO: TRY THIS MODEL OUT TOO, DOESN'T NEED WRAPPER AND MIGHT WORK BETTER
// qwen3:30b-a3b-instruct-2507-q4_K_M

const WORKDIR = process.cwd();
const DEBUG = true;

// TODO: consider whether or not second entry even does anything?
const BLOCKED_COMMANDS = ["rm -rf /", "rm -rf ../", "sudo", "shutdown", "reboot", "> /dev/"];



/*   API   */
const ollama = createOpenAI({
    baseURL: "http://host.docker.internal:11434/v1",
    apiKey: "ollama"
});

// This wrapper fixes issues with parsing the toolcalls from our model:
const model = wrapLanguageModel({
    model: ollama.chat(MODEL),
    middleware: qwen3CoderToolMiddleware
});


/*  TOOLS  */
const runBash = (command: string): string => {
    if (BLOCKED_COMMANDS.some((c) => command.includes(c))) {
        return "Error: Blocked command detected.";
    }

    try {
        const result = spawnSync("sh", ["-c", command], {
            cwd: WORKDIR,
            encoding: "utf-8",
            timeout: 120000 // Two minutes
        });

        return (result.stdout + result.stderr).trim().slice(0, 50000) || "";
    } catch (e) {
        return `Error ${e}`;
    }
}

const TOOLS = {
    bash: tool({
        description: "Run a shell command",
        inputSchema: zodSchema(z.object({ command: z.string() })),
        execute: async ({ command } : { command: string }) => {
            const output = runBash(command);
            return output;
        }
    })
}


/* AGENT LOOP */
const agentLoop = async (messages: ModelMessage[], attempt = 0): Promise<string> => {
    // const { text } = await generateText({
    const result = await generateText({
        model: Qwen3Coder, // temporarily using new one for test
        system: `You are a coding agent at ${WORKDIR}. Use bash to solve tasks. Act, don't explain. /no_think`,
        messages,
        tools: TOOLS,
        stopWhen: isLoopFinished(),
        
        // These values help prevent the model from getting stuck on bad output
        // Changing temp and seed by the attempt count helps perturb the sampling
        temperature: 0.2 + attempt * 0.1,  // 0.2, 0.3, 0.4, ...
        topP: 0.8,
        seed: Date.now() + attempt
    });

    if (DEBUG) {
        console.error("[debug] finish:", result.finishReason);
        console.error("[debug] steps:", result.steps.length);
        console.error("[debug] text:", JSON.stringify(result.text));
        console.error("[debug] content:", JSON.stringify(result.content, null, 2));
        console.error("[debug] warnings:", result.warnings);
        for (const [i, step] of result.steps.entries()) {
            console.error(`[debug] step ${i} content:`, JSON.stringify(step.content, null, 2));
            console.error(`[debug] step ${i} text:`, JSON.stringify(step.text));
            console.error(`[debug] step ${i} tool calls:`, step.toolCalls.map((t) => t.toolName));
        }
    }

    const empty = result.steps.length === 1
        && result.steps[0]?.content.length === 0
        && result.finishReason === "stop";

    if (empty && attempt < 5) {
        console.error("[debug] empty response from model, retrying once");
        return agentLoop(messages, attempt + 1);
    }
    
    return result.text;
}


/* INTERFACE */
const history: ModelMessage[] = [];
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const prompt = (): void => {
    // prompt the user
    rl.question(" input >> ", async (query) => {
        // Update our history with user's prompt
        history.push({ role: "user", content: query });
        const reply = await agentLoop(history);
        
        // Update history with response
        history.push({ role: "assistant", content: reply});

        if (reply) console.log(reply);
        console.log();

        prompt();
    })
}

// Start the loop
prompt();