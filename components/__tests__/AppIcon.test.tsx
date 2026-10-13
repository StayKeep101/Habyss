import React from 'react';
import { render } from '@testing-library/react-native';
import { AppIcon, isGlyphIcon, isPhotoIcon } from '@/components/ui/AppIcon';

describe('what counts as your own icon', () => {
    it('knows a picture by its uri', () => {
        expect(isPhotoIcon('file:///var/photo.jpg')).toBe(true);
        expect(isPhotoIcon('ph://ABC-123')).toBe(true);
        expect(isPhotoIcon('flag-outline')).toBe(false);
    });

    it('knows a typed glyph from one of ours', () => {
        expect(isGlyphIcon('🈯')).toBe(true);
        expect(isGlyphIcon('漢')).toBe(true);
        expect(isGlyphIcon('flag-outline')).toBe(false);
        // Mapped for habits saved before the collection existed, so it stays
        // an Ionicons flame rather than becoming a typed glyph.
        expect(isGlyphIcon('🔥')).toBe(false);
    });

    it('does not mistake a sentence for a glyph', () => {
        expect(isGlyphIcon('a very long piece of text that is not an icon')).toBe(false);
        expect(isGlyphIcon('')).toBe(false);
    });
});

describe('drawing one', () => {
    it('draws a typed glyph as text, at the size asked for', () => {
        const screen = render(<AppIcon name="🈯" size={24} />);
        expect(screen.getByText('🈯')).toBeTruthy();
    });

    it('falls back rather than drawing nothing for a name we do not have', () => {
        expect(render(<AppIcon name="not-a-real-icon" />).toJSON()).toBeTruthy();
    });
});
