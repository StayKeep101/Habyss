/**
 * The base64 decoder behind avatar upload.
 *
 * Exercised through a copy of the function rather than an export, because
 * profileSync pulls in Supabase to be imported at all. The point of the test is
 * that the arithmetic is right: a picture that decodes one byte short is a
 * corrupt JPEG, and nothing in the upload path would report it.
 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(input: string): Uint8Array {
    const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
    const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
    let byte = 0;
    for (let index = 0; index < clean.length; index += 4) {
        const a = B64.indexOf(clean[index]);
        const b = B64.indexOf(clean[index + 1]);
        const c = B64.indexOf(clean[index + 2]);
        const d = B64.indexOf(clean[index + 3]);
        out[byte++] = (a << 2) | (b >> 4);
        if (c >= 0) out[byte++] = ((b & 15) << 4) | (c >> 2);
        if (d >= 0) out[byte++] = ((c & 3) << 6) | d;
    }
    return out.subarray(0, byte);
}

const encode = (bytes: number[]) => Buffer.from(bytes).toString('base64');

describe('base64, for the bytes of a picture', () => {
    it('round-trips every remainder, which is where off-by-one lives', () => {
        // 0, 1 and 2 bytes over a group of three are the three padding cases.
        for (const length of [1, 2, 3, 4, 5, 6, 7, 300]) {
            const bytes = Array.from({ length }, (_, index) => (index * 37 + 11) % 256);
            expect([...decodeBase64(encode(bytes))]).toEqual(bytes);
        }
    });

    it('carries every byte value, including the high ones a JPEG is full of', () => {
        const bytes = Array.from({ length: 256 }, (_, index) => index);
        expect([...decodeBase64(encode(bytes))]).toEqual(bytes);
    });

    it('survives the newlines some readers wrap it in', () => {
        const bytes = [255, 216, 255, 224, 0, 16];
        const wrapped = encode(bytes).replace(/(.{4})/g, '$1\n');
        expect([...decodeBase64(wrapped)]).toEqual(bytes);
    });

    it('gives nothing back for nothing, rather than a stray byte', () => {
        expect(decodeBase64('').byteLength).toBe(0);
    });
});
