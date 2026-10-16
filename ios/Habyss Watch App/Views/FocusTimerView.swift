import SwiftUI
import WatchKit

struct FocusTimerView: View {
    @StateObject var vm = FocusTimerViewModel()
    
    // Focus modes to show in grid (subset for grid layout)
    let gridModes: [FocusMode] = [.pomodoro, .deepFocus, .shortBreak, .longBreak]
    // Additional modes in a list below
    let extraModes: [FocusMode] = [.flow, .sprint, .checkIn]
    
    var body: some View {
        Group {
            if vm.isRunning || vm.isPaused {
                activeTimerView
            } else {
                timerSelectionView
            }
        }
        .navigationTitle("Focus")
    }
    
    // MARK: - Active Timer
    
    var activeTimerView: some View {
        VStack(spacing: 12) {
            // Mode label
            Text(vm.selectedMode.displayName)
                .font(.system(.caption2, design: .default, weight: .semibold))
                .foregroundColor(Color(hex: vm.selectedMode.colorHex))
            
            // Circular progress ring with time
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.1), lineWidth: 6)
                
                if let session = vm.session {
                    Circle()
                        .trim(from: 0, to: session.progress)
                        .stroke(
                            Color(hex: vm.selectedMode.colorHex),
                            style: StrokeStyle(lineWidth: 6, lineCap: .round)
                        )
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 1), value: session.progress)
                }
                
                VStack(spacing: 2) {
                    Text(vm.timeRemainingString)
                        .font(.system(size: 32, weight: .bold, design: .default).monospacedDigit())
                    
                    Text(vm.isPaused ? "PAUSED" : "FOCUS")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)
                }
            }
            .frame(width: 110, height: 110)
            
            // Linked habit
            if let habit = vm.linkedHabit {
                HStack(spacing: 4) {
                    Text(habit.emoji)
                    Text(habit.title)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            
            // Controls
            HStack(spacing: 12) {
                Button {
                    vm.isPaused ? vm.resumeSession() : vm.pauseSession()
                } label: {
                    Image(systemName: vm.isPaused ? "play.fill" : "pause.fill")
                        .frame(width: 44, height: 44)
                        .background(Color.white.opacity(0.1))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                
                Button {
                    vm.endSession()
                } label: {
                    Image(systemName: "xmark")
                        .frame(width: 44, height: 44)
                        .background(Color.habyssRose.opacity(0.3))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding()
    }
    
    // MARK: - Selection View
    
    var timerSelectionView: some View {
        ScrollView {
            VStack(spacing: 10) {
                // Mode grid (2x2)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(gridModes, id: \.self) { mode in
                        ModeCard(mode: mode, isSelected: vm.selectedMode == mode) {
                            vm.selectMode(mode)
                        }
                    }
                }
                
                // Extra modes as compact buttons
                ForEach(extraModes, id: \.self) { mode in
                    Button {
                        vm.selectMode(mode)
                        vm.startSession()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: mode.icon)
                                .font(.caption)
                                .foregroundColor(Color(hex: mode.colorHex))
                            Text(mode.displayName)
                                .font(.system(.caption, design: .default, weight: .semibold))
                            Spacer()
                            Text(mode.defaultDuration > 0 ? "\(Int(mode.defaultDuration/60))m" : "∞")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(hex: mode.colorHex).opacity(0.1))
                        )
                    }
                    .buttonStyle(.plain)
                }
                
                // Start button (when a grid mode is selected)
                Button("Start") {
                    vm.startSession()
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.habyssBlue)
                .frame(maxWidth: .infinity)
            }
            .padding()
        }
    }
}

// MARK: - Mode Card

struct ModeCard: View {
    let mode: FocusMode
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: mode.icon)
                    .font(.title3)
                    .foregroundColor(Color(hex: mode.colorHex))
                
                Text(mode.displayName)
                    .font(.system(.caption2, design: .default, weight: .semibold))
                    .lineLimit(1)
                
                Text("\(Int(mode.defaultDuration/60))m")
                    .font(.system(.caption2, design: .default))
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: HabyssConstants.cornerRadius)
                    .fill(Color(hex: mode.colorHex).opacity(isSelected ? 0.25 : 0.1))
            )
            .overlay(
                RoundedRectangle(cornerRadius: HabyssConstants.cornerRadius)
                    .stroke(isSelected ? Color(hex: mode.colorHex) : Color.clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }
}
