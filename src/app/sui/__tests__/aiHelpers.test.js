import {
  getLocalAIResponse,
  getOpenRouterAIResponse,
  resolveRelationFromSource,
} from "../page";

describe("AI Helper Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe("getLocalAIResponse", () => {
    test("returns single word from local AI on success", async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ message: { content: "elephant " } }),
      });

      const result = await getLocalAIResponse("cat", "bigger", "gemma3:27b");
      expect(result).toBe("elephant");
      expect(global.fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:11434/api/chat",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("cat"),
        })
      );
    });

    test("falls back to default on local AI error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("network error"));

      const result = await getLocalAIResponse("cat", "bigger", "gemma3:27b");
      expect(result).toBe("bigger-cat");
    });
  });

  describe("getOpenRouterAIResponse", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_OPENROUTER_API_KEY = "fake-key";
    });

    test("returns single word from OpenRouter on success", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ choices: [{ message: { content: "elephant " } }] }),
      });

      const result = await getOpenRouterAIResponse(
        "cat",
        "bigger",
        "meta-llama/llama-3.1-8b-instruct:free"
      );
      expect(result).toBe("elephant");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://openrouter.ai/api/v1/chat/completions",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer fake-key",
          }),
          body: expect.stringContaining("cat"),
        })
      );
    });

    test("throws error when OpenRouter API key is missing", async () => {
      delete process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

      await expect(
        getOpenRouterAIResponse(
          "cat",
          "bigger",
          "meta-llama/llama-3.1-8b-instruct:free"
        )
      ).rejects.toThrow("OpenRouter API key not configured");
    });
  });

  describe("resolveRelationFromSource", () => {
    test("routes to local AI when mode is local", async () => {
      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        json: () => Promise.resolve({ message: { content: "local-result" } }),
      });

      const result = await resolveRelationFromSource(
        "source",
        "relation",
        "local",
        "gemma3:27b",
        null
      );
      expect(result).toBe("local-result");
      expect(global.fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:11434/api/chat",
        expect.any(Object)
      );
    });

    test("routes to OpenRouter when mode is openrouter", async () => {
      process.env.NEXT_PUBLIC_OPENROUTER_API_KEY = "fake-key";
      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: "openrouter-result" } }],
          }),
      });

      const result = await resolveRelationFromSource(
        "source",
        "relation",
        "openrouter",
        null,
        "meta-llama/llama-3.1-8b-instruct:free"
      );
      expect(result).toBe("openrouter-result");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://openrouter.ai/api/v1/chat/completions",
        expect.any(Object)
      );
    });

    test("falls back to default on resolver error", async () => {
      jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("error"));

      const result = await resolveRelationFromSource(
        "source",
        "relation",
        "local",
        "gemma3:27b",
        null
      );
      expect(result).toBe("relation-source");
    });
  });
});
