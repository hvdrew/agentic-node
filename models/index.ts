import { type LanguageModelV3Middleware } from "@ai-sdk/provider"
import { wrapLanguageModel } from "ai";
import { ollama } from "../ollama";

// TODO - find a way to persist this across files that feels clean
const WORKDIR = process.cwd();

// These each map to the actual name used in ollama
// (see `ollama show` for your local model list)
export const MODELS = {
    qwen3Coder: "qwen3-coder:30b",
    qwen3Instruct: "qwen3:30b-a3b-instruct-2507-q4_K_M",
};


/**
 * Qwen3Coder
 * - Great performance
 * - Output is solid most of the time
 * - Has several issues preventing a consistent/deterministic behavior. Requires multiple layers of fixes.
 */
const rawLogger: LanguageModelV3Middleware = {
    specificationVersion: "v3",
    wrapGenerate: async ({ doGenerate }) => {
        const result = await doGenerate();
        console.error("[raw] content:", JSON.stringify(result.content, null, 2));
        console.error("[raw] finishReason:", result.finishReason);
        console.error("[raw] usage:", result.usage);
        return result;
    },
};

export const Qwen3Coder = wrapLanguageModel({
    model: ollama.chat(MODELS.qwen3Coder),
    middleware: [rawLogger]
});

// Potentially use these to overwrite the defaults in main agent loop (via Object.assign()):
export const Qwen3CoderSettings = {
        model: Qwen3Coder,
        system: `You are a coding agent at ${WORKDIR}. Use bash to solve tasks. Act, don't explain.`,

        // These values help prevent the model from getting stuck on bad output
        // Might be able to get even better results by modifying seed and temp by attempt # somehow if needed
        temperature: 0.2,
        topP: 0.8
};


/**
 * Qwen3Instruct
 * - Should supposedly have fewer issues, including supporting the expected format for parsing. 
 * - No clue how it performs though.
 */
// export const qwen3Instruct = 