// Polyfills for missing global APIs in React Native

if (typeof global.structuredClone !== 'function') {
    global.structuredClone = function <T>(value: T): T {
        // Basic implementation using JSON serialization
        // Limitations: Doesn't handle Functions, Symbols, Circular references (throws), Maps, Sets
        // Sufficient for most data-cloning needs in AI SDKs
        return JSON.parse(JSON.stringify(value));
    };
}
