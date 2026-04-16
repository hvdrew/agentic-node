#!/usr/bin/env bun

import { generateText, isLoopFinished, tool, wrapLanguageModel, zodSchema } from "ai";
import { z } from "zod";
import type { ModelMessage } from "ai";
import { spawnSync } from "child_process";
import * as readline from "readline";

import { Qwen3Coder, Qwen3CoderSettings } from "./models";


/* CONSTANTS */
const DEBUG = true;
const WORKDIR = process.cwd();
const BLOCKED_COMMANDS = [
    "rm -rf /",
    "rm -rf ../", // TODO: Is this helpful?
    "sudo",
    "shutdown",
    "reboot",
    "> /dev/"
];


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
    const result = await generateText({
        model: Qwen3Coder, // temporarily using new one for test
        // system: `You are a coding agent at ${WORKDIR}. Use bash to solve tasks. Act, don't explain. /no_think`,
        system: `
You are an agent at ${WORKDIR} that has two modes:

1. Conversational Mode
- Used when the user is asking questions, chatting, or not requesting an action
- Respond with normal plain text

2. Action Mode
- Used when the user requests you to perform an action (file edits, commands, etc.)
- You MUST use a tool
- You MUST output ONLY valid JSON
- DO NOT include any explanation or extra text

Tool call format:
{
    "tool": "<tool_name>",
    "arguments": { ... }
}

Rules:
- NEVER output XML
- NEVER mix text and JSON
- If an action is required → ONLY JSON
- If no action is required → ONLY plain text
    `,
        messages,
        tools: TOOLS,
        stopWhen: isLoopFinished()
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

    // Probably don't need this loop anymore, should try and resolve the issue behind it first
    // const empty = result.steps.length === 1
    //     && result.steps[0]?.content.length === 0
    //     && result.finishReason === "stop";

    // if (empty && attempt < 5) {
    //     console.error("[debug] empty response from model, retrying once");
    //     return agentLoop(messages, attempt + 1);
    // }
    
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
        // Update history with user's prompt
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