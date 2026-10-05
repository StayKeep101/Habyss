//
//  WidgetBundle.swift
//  Widget
//
//  Created by erwan on 2026-02-14.
//

import WidgetKit
import SwiftUI

@main
struct HabyssWidgetBundle: WidgetBundle {
    var body: some Widget {
        HabyssWidget()
        HabyssHeatmapWidget()
        HabyssGoalsWidget()
        HabyssEchoWidget()
        HabyssQuickAddWidget()
        // WidgetControl() // Requires iOS 18.0
        HabyssLiveActivity()
    }
}
