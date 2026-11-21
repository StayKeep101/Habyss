import { NativeModules } from 'react-native';
import { setNowPlan } from '../nowGuide';

it('hands the monitor only what is still to come, in order', () => {
    const send = jest.fn();
    NativeModules.ScreenTimeModule = { setNowPlan: send };
    const now = Date.now() / 1000;
    setNowPlan([
        { at: now + 600, title: 'B', body: '', category: null, sound: null, data: {} },
        { at: now - 60, title: 'Gone', body: '', category: null, sound: null, data: {} },
        { at: now + 60, title: 'A', body: '', category: null, sound: null, data: {} },
    ]);
    expect(JSON.parse(send.mock.calls[0][0]).map((m: { title: string }) => m.title)).toEqual(['A', 'B']);
});
