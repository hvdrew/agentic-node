import { createOpenAI } from "@ai-sdk/openai";

export const ollama = createOpenAI({
    baseURL: "http://host.docker.internal:11434/v1",
    apiKey: "ollama"
});
