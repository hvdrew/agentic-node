# General
Attempting to better understand how one might go from having an LLM to having an Agentic setup like Claude Code or Codex.

I will be using Qwen3.5 in all likelyhood, running in Ollama. I will also use this project as a chance to check out `bun` instead of `node`, mainly to check out the native typescript support.

## Installing
To install on Windows 11, simply run:
```powershell
bun install
```

You will need a model locally as well using Ollama. If you don't already have one, make sure to grab that before proceeding.

From here, update the model name in `index.ts` if needed, then run:
```powershell
npm run dev
```

This will build the necessary docker container for the project and start the application.

## NPM Commands
    - "dev": Runs the Docker container if needed, then starts the REPL for the application
    - "dev:rebuild": Normal rebuild, should handle 99% of any issues with stale containers
    - "dev:full-rebuild": Rebuilds the project, forcing a wipe of `node_modules` in the process. Helpful for stale containers that won't rebuild completely
    - "dev:stop": Stops the detached docker container in the background. Run this when you're closing the project down for the day


## Notes
Because I'm working with my personal machine this project is set up for Windows development. This doesn't affect much in the grand scheme of things, but there are a few caveats:
1. Docker will be used to provide a Linux environment for the agent to run within. This is to ensure it has access to the more common linux toolset instead of PowerShell, meaning it can use things like `bash`.
2. Usage of Docker means we need to account for the difference in network interfaces. For my machine I have hardcoded a baseUrl for the Ollama endpoint to `"http://host.docker.internal:11434/v1"`. If running on a linux or unix environment you'll likely want to use `localhost` for your baseUrl instead.

Currently the only thing protecting the host machine from dangerous commands is a hardcoded blacklist. I should work on setting up permissions for the LLM similar to Aider, where the user adds files to context/working dir as needed instead of giving full access by default.

## Which Model?
As with most of this stuff, YMMV. You'll want to find a model that has a good balance of compression/small size, response speed/token throughput, and actual quality of the output. Depending on your hardware you'll likely want to use different options than I am. Update the `MODEL` constant to whatever value you'd like to try. To find all of the names you can use here based on your ollama pulls, run `ollama list`.

Throughout this I might switch models a few times. Keeping track of how each one does here. Later on I want to add a mechanism to record response timing between each model, testing the same text inputs across them, potentially a few times. Until then, these accounts will have to do:
- "qwen3.5:35b-a3b"
    - Way too slow, definitely not.
    - 23GB, meaning a huge chunk of this thing is running on my CPU/RAM. Explains the speed.
- "qwen2.5-coder:7b-instruct"
    - Extremely fast! Also only 4.7GB
    - Have yet to really test output quality. We'll see if the older Qwen can hold up
- "qwen3-coder:30b"
    - 18GB, so I expected similar issues, and yet it's not that slow!
    - Response times varied, but with quick chats it wasn't more than a second. A longer generation task took about 15-20 seconds, but that's still not terrible.
- "qwen3:14b"
    - Somehow slower than the qwen3-coder:30b? Not sure how. It's half the size and has half as many prompts.
    - Something might be wrong with my modelfile on one or both of these. Should check it out for sure.
- "phi4-mini:latest"
    - Just for fun really. This one might come in handy as a companion to the main model though, you never know. It's only 2.5GB ¯\_(ツ)_/¯ 
    - Yeah I'm not sure about this one being useful. It's fast, that's for sure! But it really lacks the ability to generate believable responses. I asked it who the first president was, then asked who the twenty fifth president was, just to test it's ability to consider the chat history when answering. It somehow landed on Joe Biden as the 25th president, because "there's only one president who was in office on December 31, 2020"... lol


As of right now the best one I've messed with so far has been `qwen3-coder:30b`, which, when asked to write a TS function that demonstrates async behavior, output this:
```typescript
// Simple async function that returns a promise
async function fetchUserData(userId: number): Promise<{id: number, name: string, email: string}> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return mock user data
    return {
        id: userId,
        name: `User ${userId}`,
        email: `user${userId}@example.com`
    };
}

// Function demonstrating async/await with multiple operations
async function processUserActivity(userId: number): Promise<string> {
    try {
        console.log(`Starting to process user ${userId}...`);
        
        // First async operation
        const userData = await fetchUserData(userId);
        console.log('User data fetched:', userData);
        
        // Second async operation (simulating another API call)
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('Processing user activity...');
        
        // Third async operation
        await new Promise(resolve => setTimeout(resolve, 300));
        console.log('Activity processed successfully!');
        
        return `User ${userData.name} processed successfully`;
    } catch (error) {
        console.error('Error processing user:', error);
        throw error;
    }
}

// Function demonstrating concurrent async operations
async function fetchMultipleUsers(userIds: number[]): Promise<void> {
    console.log('Starting concurrent user fetch operations...');
    
    // All promises will run in parallel
    const promises = userIds.map(userId => fetchUserData(userId));
    const results = await Promise.all(promises);
    
    console.log('All users fetched:', results);
}

// Example usage
async function demonstrateAsyncBehavior(): Promise<void> {
    console.log('=== Async Behavior Demo ===');
    
    // Sequential async operations
    const result1 = await processUserActivity(1);
    console.log(result1);
    
    // Concurrent async operations
    await fetchMultipleUsers([2, 3, 4]);
    
    console.log('All async operations completed!');
}

// Run the demo (uncomment to execute)
// demonstrateAsyncBehavior();

// Alternative: Function that returns a promise directly
function delayedGreeting(name: string): Promise<string> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(`Hello, ${name}!`);
        }, 1500);
    });
}

// Usage example
async function exampleWithPromise(): Promise<void> {
    const greeting = await delayedGreeting("Alice");
    console.log(greeting); // Logs after 1.5 seconds
}
```

Which:
1. Runs without error
2. Actually demonstrates the requested behavior within the console at runtime
3. Was thoroughly and correctly explained by the model

---

Later on I could and probably should allow swapping to different models based on the output of `ollama list`.