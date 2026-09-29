import AsyncStorage from '@react-native-async-storage/async-storage';

const mockRpc = jest.fn();
jest.mock('../supabase', () => ({
    getSupabase: () => ({ rpc: mockRpc }),
    isCloudConfigured: () => true,
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));

import { clientId, describeApp, flushFeedback, pendingFeedback, sendFeedback } from '../feedback';

beforeEach(async () => {
    await AsyncStorage.clear();
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: 'id', error: null });
});

describe('sending', () => {
    it('sends what was written, with what the app knows about itself', async () => {
        await sendFeedback('The streak is wrong', { screen: 'home' });

        expect(mockRpc).toHaveBeenCalledWith('submit_feedback', expect.objectContaining({
            p_message: 'The streak is wrong',
            p_context: expect.objectContaining({ screen: 'home', version: '1.0.0' }),
        }));
    });

    it('sends nothing for an empty message', async () => {
        await expect(sendFeedback('   ')).resolves.toBe(false);
        expect(mockRpc).not.toHaveBeenCalled();
    });

    it('trims a message down to what the column will take', async () => {
        await sendFeedback('x'.repeat(5000));
        expect(String(mockRpc.mock.calls[0][1].p_message)).toHaveLength(2000);
    });

    it('leaves nothing in the queue once it is away', async () => {
        await sendFeedback('Fine');
        expect(await pendingFeedback()).toBe(0);
    });
});

describe('when it cannot be sent', () => {
    it('keeps it rather than losing it, and still says it is sent', async () => {
        // From where the person is standing it *has* been sent: it is written
        // down and it is going. The only thing worse than a Send button that
        // lies is one that loses what you wrote.
        mockRpc.mockResolvedValue({ data: null, error: { message: 'offline' } });

        await expect(sendFeedback('Written on a train')).resolves.toBe(true);
        expect(await pendingFeedback()).toBe(1);
    });

    it('survives the client throwing rather than returning an error', async () => {
        mockRpc.mockRejectedValue(new Error('no network at all'));
        await expect(sendFeedback('Still written')).resolves.toBe(true);
        expect(await pendingFeedback()).toBe(1);
    });

    it('sends the queue on the next launch', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
        await sendFeedback('One');
        await sendFeedback('Two');
        expect(await pendingFeedback()).toBe(2);

        mockRpc.mockResolvedValue({ data: 'id', error: null });
        expect(await flushFeedback()).toBe(2);
        expect(await pendingFeedback()).toBe(0);
    });

    it('keeps what still will not go, in the order it was written', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
        await sendFeedback('First');
        await sendFeedback('Second');

        // Only the first gets through this time.
        mockRpc.mockReset();
        mockRpc.mockResolvedValueOnce({ data: 'id', error: null })
            .mockResolvedValue({ data: null, error: { message: 'still offline' } });

        expect(await flushFeedback()).toBe(1);
        expect(await pendingFeedback()).toBe(1);
    });

    it('does not grow without limit', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
        for (let index = 0; index < 30; index++) await sendFeedback(`Note ${index}`);
        // A queue that grows forever is a memory leak with good intentions.
        expect(await pendingFeedback()).toBe(20);
    });
});

describe('the install id', () => {
    it('is made once and then kept', async () => {
        const first = await clientId();
        expect(await clientId()).toBe(first);
        expect(first.startsWith('c-')).toBe(true);
    });
});

describe('what is collected rather than typed', () => {
    it('carries the platform and the version, and whatever the caller adds', () => {
        const context = describeApp({ screen: 'settings', theme: 'abyss' });
        expect(context).toMatchObject({ screen: 'settings', theme: 'abyss', version: '1.0.0' });
        expect(context.platform).toBeTruthy();
    });
});
