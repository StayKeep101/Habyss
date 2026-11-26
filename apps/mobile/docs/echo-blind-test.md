# Echo blind test

The honest test of whether Echo sounds human: can people tell its lines from a real coach's?

## Run it

1. Print Echo's sheet for a voice:

   ```sh
   npm run echo:sample                        # Normal
   ECHO_VOICE=bully_mode npm run echo:sample  # friendly, dad_mode, bully_mode, goofball
   ```

   It prints ten everyday situations, described plainly, and Echo's line for each (`lib/echoBlindTest.ts`).

2. Give **only the situations** to a person who coaches or texts like a good friend. Ask them to write one message per situation, in the same voice, as if texting.
3. Mix the 10 Echo lines and the 10 human lines into one shuffled list of 20.
4. Show the list to 5–10 people who use the app. For each line: **"Person or app?"**
5. Score each Echo line by how often it was called "app".

## Act on it

- Any Echo line called "app" by more than half: rewrite it (`lib/echoBrief.ts`, `lib/echoLines.ts`, `lib/echoHuman.ts`).
- Look for the *why* in the human lines that fooled nobody: usually they are shorter, less symmetrical, more specific, and ask more questions.
- Re-run the sheet after each round. Aim for Echo being guessed no better than chance (about half).

## What it has already caught

The first run caught: the same phrase twice in one line ("the best part of an hour … the best part of an hour"), a sentence starting in lowercase after a number became a word, and an odd rounding ("the best part of an hour" for 40 minutes). All fixed.
