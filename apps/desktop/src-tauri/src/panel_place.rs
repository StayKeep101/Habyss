//! Where the menu bar panel opens: on the display whose menu bar was clicked, under the icon, inside that display.
//!
//! The system lists displays in physical pixels, each with its own scale (a Retina laptop is 2×, an external monitor
//! often 1×). Pixels of two displays cannot be compared, so a click converted with the wrong display's scale put the
//! panel on the first display. Here everything is in points, the Mac's own unit, the same on every display: each display
//! is turned into points with its own scale, and the click comes from the system in points (NSEvent.mouseLocation).

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Display {
    /// Frame in physical pixels, as the system lists it.
    pub x: f64, pub y: f64, pub width: f64, pub height: f64, pub scale: f64,
    /// Top of the usable area (under the menu bar), physical pixels.
    pub work_top: f64,
}
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Placement { pub x: f64, pub y: f64, pub width: f64, pub height: f64 }

const MARGIN: f64 = 8.0;
const GAP: f64 = 6.0;
const MIN_HEIGHT: f64 = 320.0;

/// `click` in points from the top-left of the main display; `size` the panel's wanted size in points.
/// Returns the panel's frame in points: under the menu bar of the clicked display, centred on the click, inside it,
/// as tall as wanted or as the display allows.
pub fn place(displays: &[Display], click: (f64, f64), size: (f64, f64)) -> Option<Placement> {
    let pts = |d: &Display| { let s = if d.scale > 0.0 { d.scale } else { 1.0 }; (d.x / s, d.y / s, (d.x + d.width) / s, (d.y + d.height) / s, d.work_top / s) };
    let (cx, cy) = click;
    let d = displays.iter().map(pts).find(|&(l, t, r, b, _)| cx >= l && cx < r && cy >= t && cy < b)
        .or_else(|| displays.iter().map(pts).min_by(|a, b| dist(cx, cy, a).total_cmp(&dist(cx, cy, b))))?;
    let (left, top, right, bottom, work_top) = d;
    let width = size.0.min(right - left - 2.0 * MARGIN);
    let y = work_top.max(top) + GAP;
    let height = size.1.min(bottom - MARGIN - y).max(MIN_HEIGHT.min(bottom - MARGIN - y));
    let x = (cx - width / 2.0).max(left + MARGIN).min(right - MARGIN - width);
    Some(Placement { x, y, width, height })
}

fn dist(x: f64, y: f64, (l, t, r, b, _): &(f64, f64, f64, f64, f64)) -> f64 {
    let dx = if x < *l { l - x } else if x > *r { x - r } else { 0.0 };
    let dy = if y < *t { t - y } else if y > *b { y - b } else { 0.0 };
    dx * dx + dy * dy
}

#[cfg(test)]
mod tests {
    use super::*;
    // A 1512×982 pt Retina laptop at 2× (menu bar 37 pt), with a 1920×1080 monitor at 1× to its right (menu bar 25 pt).
    const LAPTOP: Display = Display { x: 0.0, y: 0.0, width: 3024.0, height: 1964.0, scale: 2.0, work_top: 74.0 };
    const MONITOR: Display = Display { x: 1512.0, y: 0.0, width: 1920.0, height: 1080.0, scale: 1.0, work_top: 25.0 };

    #[test] fn opens_under_the_menu_bar_centred_on_the_click() {
        let p = place(&[LAPTOP, MONITOR], (1000.0, 12.0), (660.0, 720.0)).unwrap();
        assert_eq!((p.x, p.y, p.width, p.height), (670.0, 43.0, 660.0, 720.0));
    }
    #[test] fn a_click_on_the_second_display_opens_there() {
        let p = place(&[LAPTOP, MONITOR], (2900.0, 10.0), (660.0, 720.0)).unwrap();
        assert!(p.x >= 1512.0 && p.x + p.width <= 1512.0 + 1920.0, "{p:?}");
        assert_eq!(p.y, 31.0);
    }
    #[test] fn stays_inside_the_edge_of_its_display() {
        let p = place(&[LAPTOP, MONITOR], (3420.0, 10.0), (660.0, 720.0)).unwrap();
        assert_eq!(p.x + p.width, 1512.0 + 1920.0 - 8.0);
        let q = place(&[LAPTOP, MONITOR], (1500.0, 10.0), (660.0, 720.0)).unwrap();
        assert_eq!(q.x + q.width, 1512.0 - 8.0, "a click near the laptop's right edge stays on the laptop");
    }
    #[test] fn shrinks_to_the_room_on_a_short_display() {
        let short = Display { x: 0.0, y: 0.0, width: 1280.0, height: 600.0, scale: 1.0, work_top: 25.0 };
        let p = place(&[short], (600.0, 10.0), (660.0, 720.0)).unwrap();
        assert_eq!(p.y, 31.0);
        assert_eq!(p.y + p.height, 600.0 - 8.0);
    }
    #[test] fn a_display_above_the_main_one() {
        // Arranged above: negative y in points.
        let above = Display { x: 0.0, y: -2160.0, width: 3840.0, height: 2160.0, scale: 2.0, work_top: -2110.0 };
        let p = place(&[LAPTOP, above], (900.0, -1070.0), (660.0, 720.0)).unwrap();
        assert_eq!(p.y, -1055.0 + 6.0);
    }
}

/// The pointer, in points from the top-left of the main display (AppKit counts up from its bottom-left).
#[cfg(target_os = "macos")]
pub fn pointer(displays: &[Display]) -> Option<(f64, f64)> {
    let main = displays.iter().find(|d| d.x == 0.0 && d.y == 0.0)?;
    let at = objc2_app_kit::NSEvent::mouseLocation();
    Some((at.x, main.height / main.scale - at.y))
}
#[cfg(not(target_os = "macos"))]
pub fn pointer(_: &[Display]) -> Option<(f64, f64)> { None }

/// A light tick on the trackpad, as the phone's selection haptic: felt only while a finger is on it.
#[cfg(target_os = "macos")]
pub fn tick() {
    use objc2_app_kit::{NSHapticFeedbackManager, NSHapticFeedbackPattern, NSHapticFeedbackPerformanceTime, NSHapticFeedbackPerformer};
    NSHapticFeedbackManager::defaultPerformer().performFeedbackPattern_performanceTime(NSHapticFeedbackPattern::Alignment, NSHapticFeedbackPerformanceTime::Now);
}
#[cfg(not(target_os = "macos"))]
pub fn tick() {}
