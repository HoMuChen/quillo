if (!process.env.ENCRYPTION_KEY) {
  // 32 random bytes base64-encoded, test-only key
  process.env.ENCRYPTION_KEY = 'tLqWLOTEczqvwFd0c3p80dLlk0zdP1Z5JEszyDkHVCg='
}
