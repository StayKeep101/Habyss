import { holdLaunchLink, routeOf, takeLaunchLink } from '../launchLink';

describe('a link Habyss is opened with, held over the launch', () => {
    it('reads the app’s own links as routes', () => {
        expect(routeOf('habyss://add?kind=task')).toBe('/add?kind=task');
        expect(routeOf('habyss://roadmap')).toBe('/roadmap');
        expect(routeOf('habyss://home')).toBeNull();
        expect(routeOf('habyss://')).toBeNull();
        expect(routeOf('exp+habyss://expo-development-client/?url=x')).toBeNull();
        expect(routeOf('https://example.com')).toBeNull();
    });
    it('keeps one, and gives it back once', () => {
        expect(holdLaunchLink('habyss://add?kind=habit')).toBe(true);
        expect(takeLaunchLink()).toBe('/add?kind=habit');
        expect(takeLaunchLink()).toBeNull();
        expect(holdLaunchLink('habyss://home')).toBe(false);
    });
});
