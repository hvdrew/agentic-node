import { type LanguageModelV3Middleware } from "@ai-sdk/provider"
import { qwen3CoderToolMiddleware } from "@ai-sdk-tool/parser";
import { wrapLanguageModel } from "ai";
import { ollama } from "../ollama";

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
    middleware: [qwen3CoderToolMiddleware, rawLogger]
});


/**
 * Qwen3Instruct
 * - Should supposedly have fewer issues, including supporting the expected format for parsing. 
 * - No clue how it performs though.
 */
// export const qwen3Instruct = 