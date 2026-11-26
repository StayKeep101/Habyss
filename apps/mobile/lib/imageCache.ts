import * as FileSystem from 'expo-file-system/legacy';

/**
 * Pictures from the web (a profile photo synced from the account), kept on
 * the phone after the first time, so a page shows them at once instead of
 * downloading them on every visit. A local picture is used as it is.
 */
const known = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

const fileFor = (url: string) => {
    let hash = 0;
    for (let index = 0; index < url.length; index++) hash = (hash * 31 + url.charCodeAt(index)) | 0;
    const ext = (url.split('?')[0].match(/\.(png|jpe?g|webp|heic)$/i)?.[0] ?? '.jpg').toLowerCase();
    return `${FileSystem.cacheDirectory ?? ''}img-${(hash >>> 0).toString(36)}${ext}`;
};

/** The phone's copy of a picture if there is one yet, else the picture as given. */
export function cachedNow(uri: string | null | undefined): string | null {
    if (!uri) return null;
    if (!/^https?:/i.test(uri)) return uri;
    return known.get(uri) ?? uri;
}

/** Keeps a copy of a web picture on the phone; resolves to the copy (or the web address if that fails). */
export function cacheImage(uri: string): Promise<string> {
    if (!/^https?:/i.test(uri) || !FileSystem.cacheDirectory) return Promise.resolve(uri);
    const done = known.get(uri);
    if (done) return Promise.resolve(done);
    const running = pending.get(uri);
    if (running) return running;
    const file = fileFor(uri);
    const work = FileSystem.getInfoAsync(file)
        .then(info => (info.exists ? file : FileSystem.downloadAsync(uri, file).then(result => (result.status === 200 ? file : uri))))
        .catch(() => uri)
        .then(local => { if (local !== uri) known.set(uri, local); pending.delete(uri); return local; });
    pending.set(uri, work);
    return work;
}
