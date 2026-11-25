import ActivityKit
import AVFoundation
import ExpoModulesCore
import MapKit
import SwiftUI
#if canImport(AlarmKit)
import AlarmKit
#endif

// Must stay identical to WidgetAttributes in ios/Widget/WidgetLiveActivity.swift.
// ActivityKit pairs an activity with the widget declaring an attributes type of the same name.
struct WidgetAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var title: String
    var subtitle: String
    var timerEndDateInMilliseconds: Double?
    var progress: Double
    var profileImagePath: String?
    var scheduledStartDateInMilliseconds: Double?
    var scheduledEndDateInMilliseconds: Double?
    var url: String?
    var accentHex: String?
    /// The habit or task on the card ("habit:<id>", "task:<id>"), for its Done button.
    var itemId: String?
    /// What comes after it on the timeline: shown once this one's time is up,
    /// so the card moves on by itself instead of going stale.
    var nextTitle: String?
    var nextStartMs: Double?
    var nextEndMs: Double?
    var nextItemId: String?
    var nextUrl: String?
    /// What follows the next, as JSON [{t,s,e,i,u}]: the card's Done moves through them.
    var later: String?
  }

  var name: String
  var totalDurationSeconds: Double?
}

struct LiveActivityConfig: Record {
  @Field var name: String = "Habyss Live Activity"
  @Field var totalDurationSeconds: Double? = nil
}

struct LiveActivityState: Record {
  @Field var title: String = ""
  @Field var subtitle: String = ""
  @Field var timerEndDateInMilliseconds: Double? = nil
  @Field var progress: Double = 0
  @Field var profileImagePath: String? = nil
  @Field var scheduledStartDateInMilliseconds: Double? = nil
  @Field var scheduledEndDateInMilliseconds: Double? = nil
  @Field var url: String? = nil
  @Field var accentHex: String? = nil

  var contentState: WidgetAttributes.ContentState {
    WidgetAttributes.ContentState(
      title: title,
      subtitle: subtitle,
      timerEndDateInMilliseconds: timerEndDateInMilliseconds,
      progress: progress,
      profileImagePath: profileImagePath,
      scheduledStartDateInMilliseconds: scheduledStartDateInMilliseconds,
      scheduledEndDateInMilliseconds: scheduledEndDateInMilliseconds,
      url: url, accentHex: accentHex
    )
  }
}

/// No stored state, so restating what the base class already promises is the
/// whole of it — Swift 6 will not infer `@unchecked Sendable` through a
/// subclass and says so on every build otherwise.
final class LiveActivitiesUnavailableException: Exception, @unchecked Sendable {
  override var reason: String {
    "Live Activities require iOS 16.2 or later"
  }
}

final class ActivityNotFoundException: GenericException<String>, @unchecked Sendable {
  override var reason: String {
    "Live Activity not found: \(param)"
  }
}

struct ScheduledActivityPlan: Record {
  @Field var key: String = ""
  @Field var title: String = ""
  @Field var start: Double = 0
  @Field var end: Double = 0
  @Field var url: String = "habyss://roadmap"
  @Field var accentHex: String = "#6B8AF5"
  @Field var itemId: String? = nil
  @Field var nextTitle: String? = nil
  @Field var nextStart: Double? = nil
  @Field var nextEnd: Double? = nil
  @Field var nextItemId: String? = nil
  @Field var nextUrl: String? = nil
  @Field var later: String? = nil
}

/// A moment that rings as an alarm (AlarmKit): Leave now, Start now.
struct AlarmMoment: Record {
  @Field var at: Double = 0
  @Field var title: String = ""
}

#if canImport(AlarmKit)
/// Echo's morning alarm carries nothing but its title.
@available(iOS 26.0, *)
struct EchoAlarmMetadata: AlarmMetadata {}
#endif

/// Where the morning alarm's id is kept, so a new time replaces it rather than adding one.
private let morningAlarmKey = "habyss_morning_alarm_id"
/// Today's Leave now and Start now alarms, replaced together.
private let momentAlarmsKey = "habyss_moment_alarm_ids"

public class HabyssLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HabyssLiveActivity")

    // A notification's voice, spoken on the phone: "Start Study now" written once as a
    // sound file in Library/Sounds (where notifications find their sounds) and played
    // as that notification's sound. Clips from earlier days are cleared as new ones are made.
    AsyncFunction("speakToSound") { (text: String, name: String) async -> Bool in
      await SpokenSound.make(text: text, name: name)
    }

    // Places by name, as Maps finds them (next build): "gym", "Ottawa Hospital",
    // "123 Bank St", nearest first around where the map is. Each is a name, an
    // address line and a point. Nothing found, or a failure: [].
    AsyncFunction("searchPlaces") { (query: String, latitude: Double, longitude: Double) async -> [[String: Any]] in
      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = query
      request.resultTypes = [.pointOfInterest, .address]
      if latitude != 0 || longitude != 0 {
        request.region = MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                                            latitudinalMeters: 20_000, longitudinalMeters: 20_000)
      }
      guard let response = try? await MKLocalSearch(request: request).start() else { return [] }
      return response.mapItems.prefix(8).map { item in
        let mark = item.placemark
        let line = [mark.subThoroughfare, mark.thoroughfare, mark.locality].compactMap { $0 }.joined(separator: " ")
        return [
          "name": item.name ?? line,
          "address": line,
          "latitude": mark.coordinate.latitude,
          "longitude": mark.coordinate.longitude,
        ]
      }
    }

    // Echo's morning alarm (AlarmKit, iOS 26+): a real alarm that rings through
    // Silent and Focus at wake time, every day, with Echo's line as its title.
    Function("alarmsAvailable") { () -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return true }
      #endif
      return false
    }

    AsyncFunction("scheduleMorningAlarm") { (hour: Int, minute: Int, title: String) async -> String in
      #if canImport(AlarmKit)
      guard #available(iOS 26.0, *) else { return "unavailable" }
      let manager = AlarmManager.shared
      do {
        var state = manager.authorizationState
        if state == .notDetermined { state = try await manager.requestAuthorization() }
        guard state == .authorized else { return "denied" }
        if let old = UserDefaults.standard.string(forKey: morningAlarmKey), let oldId = UUID(uuidString: old) {
          try? manager.cancel(id: oldId)
        }
        let alert: AlarmPresentation.Alert
        if #available(iOS 26.1, *) {
          alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: title))
        } else {
          alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: title),
            stopButton: AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.circle"))
        }
        let attributes = AlarmAttributes<EchoAlarmMetadata>(
          presentation: AlarmPresentation(alert: alert), metadata: nil, tintColor: .indigo)
        let everyDay: [Locale.Weekday] = [.sunday, .monday, .tuesday, .wednesday, .thursday, .friday, .saturday]
        let configuration = AlarmManager.AlarmConfiguration(
          countdownDuration: nil,
          schedule: .relative(.init(time: .init(hour: hour, minute: minute), repeats: .weekly(everyDay))),
          attributes: attributes,
          sound: .default)
        let id = UUID()
        _ = try await manager.schedule(id: id, configuration: configuration)
        UserDefaults.standard.set(id.uuidString, forKey: morningAlarmKey)
        return "scheduled"
      } catch {
        return "failed"
      }
      #else
      return "unavailable"
      #endif
    }

    // Leave now and Start now as real alarms (AlarmKit, iOS 26+): they ring
    // through Silent and Focus and on a paired Apple Watch, so nobody needs
    // the phone in hand to know it is time. Today's are replaced as a set.
    AsyncFunction("scheduleMomentAlarms") { (moments: [AlarmMoment]) async -> String in
      #if canImport(AlarmKit)
      guard #available(iOS 26.0, *) else { return "unavailable" }
      let manager = AlarmManager.shared
      do {
        var state = manager.authorizationState
        if state == .notDetermined { state = try await manager.requestAuthorization() }
        guard state == .authorized else { return "denied" }
        for old in UserDefaults.standard.stringArray(forKey: momentAlarmsKey) ?? [] {
          if let id = UUID(uuidString: old) { try? manager.cancel(id: id) }
        }
        var ids: [String] = []
        for moment in moments {
          let date = Date(timeIntervalSince1970: moment.at / 1000)
          guard date > Date() else { continue }
          let alert: AlarmPresentation.Alert
          if #available(iOS 26.1, *) {
            alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: moment.title))
          } else {
            alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: moment.title),
              stopButton: AlarmButton(text: "OK", textColor: .white, systemImageName: "checkmark.circle"))
          }
          let attributes = AlarmAttributes<EchoAlarmMetadata>(
            presentation: AlarmPresentation(alert: alert), metadata: nil, tintColor: .indigo)
          let configuration = AlarmManager.AlarmConfiguration(
            countdownDuration: nil, schedule: .fixed(date), attributes: attributes, sound: .default)
          let id = UUID()
          _ = try await manager.schedule(id: id, configuration: configuration)
          ids.append(id.uuidString)
        }
        UserDefaults.standard.set(ids, forKey: momentAlarmsKey)
        return "scheduled"
      } catch {
        return "failed"
      }
      #else
      return "unavailable"
      #endif
    }

    AsyncFunction("cancelMorningAlarm") { () async -> Void in
      #if canImport(AlarmKit)
      guard #available(iOS 26.0, *) else { return }
      if let old = UserDefaults.standard.string(forKey: morningAlarmKey), let oldId = UUID(uuidString: old) {
        try? AlarmManager.shared.cancel(id: oldId)
      }
      UserDefaults.standard.removeObject(forKey: morningAlarmKey)
      #endif
    }

    // Low Power Mode: the app calms its own motion while it is on (lib/lowPower.ts).
    Function("isLowPowerMode") { () -> Bool in
      return ProcessInfo.processInfo.isLowPowerModeEnabled
    }

    Function("areActivitiesEnabled") { () -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    Function("supportsScheduledActivities") { () -> Bool in
      if #available(iOS 26.0, *) { return true }
      return false
    }

    AsyncFunction("reconcileScheduledActivities") { (plans: [ScheduledActivityPlan]) async -> [String: Int] in
      guard #available(iOS 16.2, *) else { return ["scheduled": 0, "failed": 0] }
      let desired = Set(plans.map { "scheduled:" + $0.key })
      for activity in Activity<WidgetAttributes>.activities where activity.attributes.name.hasPrefix("scheduled:") {
        if !desired.contains(activity.attributes.name) {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
      // The timeline's card takes over from any focus card left behind: one card only.
      if !plans.isEmpty {
        for activity in Activity<WidgetAttributes>.activities where !activity.attributes.name.hasPrefix("scheduled:") {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { return ["scheduled": 0, "failed": plans.count] }
      var scheduled = 0
      var failed = 0
      for plan in plans {
        let name = "scheduled:" + plan.key
        let end = Date(timeIntervalSince1970: plan.end / 1000)
        guard end > Date() else { continue }
        let state = WidgetAttributes.ContentState(
          title: plan.title, subtitle: "", timerEndDateInMilliseconds: nil,
          progress: 0, profileImagePath: nil, scheduledStartDateInMilliseconds: plan.start,
          scheduledEndDateInMilliseconds: plan.end, url: plan.url, accentHex: plan.accentHex,
          itemId: plan.itemId, nextTitle: plan.nextTitle, nextStartMs: plan.nextStart, nextEndMs: plan.nextEnd,
          nextItemId: plan.nextItemId, nextUrl: plan.nextUrl, later: plan.later)
        // Stale at its end: the card then shows what comes next (ios/Widget/WidgetLiveActivity.swift).
        let content = ActivityContent(state: state, staleDate: end)
        if let existing = Activity<WidgetAttributes>.activities.first(where: { $0.attributes.name == name }) {
          if existing.content.state != state { await existing.update(content) }
          scheduled += 1
          continue
        }
        do {
          let attributes = WidgetAttributes(name: name, totalDurationSeconds: (plan.end - plan.start) / 1000)
          let start = Date(timeIntervalSince1970: plan.start / 1000)
          if start > Date() {
            if #available(iOS 26.0, *) {
              _ = try Activity.request(attributes: attributes, content: content, pushType: nil, style: .standard,
                alertConfiguration: AlertConfiguration(title: "Time for \(plan.title)", body: "Your next step is ready in Habyss.", sound: .default), start: start)
            } else {
              // No scheduling before iOS 26: the card shows now, as what is up next.
              _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
            }
          } else {
            _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
          }
          scheduled += 1
        } catch { failed += 1 }
      }
      return ["scheduled": scheduled, "failed": failed]
    }

    Function("listActivities") { () -> [String] in
      guard #available(iOS 16.2, *) else { return [] }
      return Activity<WidgetAttributes>.activities.map { $0.id }
    }

    Function("startActivity") { (config: LiveActivityConfig, state: LiveActivityState) throws -> String in
      guard #available(iOS 16.2, *) else { throw LiveActivitiesUnavailableException() }
      // Only ever one card: the new one replaces whatever is on the Lock Screen.
      let previous = Activity<WidgetAttributes>.activities
      Task { for old in previous { await old.end(nil, dismissalPolicy: .immediate) } }
      let activity = try Activity.request(
        attributes: WidgetAttributes(name: config.name, totalDurationSeconds: config.totalDurationSeconds),
        content: ActivityContent(state: state.contentState, staleDate: nil),
        pushType: nil
      )
      return activity.id
    }

    AsyncFunction("updateActivity") { (activityId: String, state: LiveActivityState) async throws in
      guard #available(iOS 16.2, *) else { throw LiveActivitiesUnavailableException() }
      guard let activity = Activity<WidgetAttributes>.activities.first(where: { $0.id == activityId }) else {
        throw ActivityNotFoundException(activityId)
      }
      await activity.update(ActivityContent(state: state.contentState, staleDate: nil))
    }

    AsyncFunction("stopActivity") { (activityId: String, state: LiveActivityState) async throws in
      guard #available(iOS 16.2, *) else { throw LiveActivitiesUnavailableException() }
      guard let activity = Activity<WidgetAttributes>.activities.first(where: { $0.id == activityId }) else {
        throw ActivityNotFoundException(activityId)
      }
      await activity.end(ActivityContent(state: state.contentState, staleDate: nil), dismissalPolicy: .immediate)
    }
  }
}


/// Writes speech to a sound file a notification can play (Library/Sounds/<name>).
enum SpokenSound {
  static let prefix = "say_"
  private static var synthesizer: AVSpeechSynthesizer?

  static func make(text: String, name: String) async -> Bool {
    // The App Group's Library/Sounds: found by notifications from the app and from its
    // Screen Time monitor alike (the app's own Library/Sounds when there is no group).
    let shared = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.habyss.data")?.appendingPathComponent("Library", isDirectory: true)
    guard let library = shared ?? FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first else { return false }
    let folder = library.appendingPathComponent("Sounds", isDirectory: true)
    try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    clearOld(in: folder)
    let target = folder.appendingPathComponent(name)
    if FileManager.default.fileExists(atPath: target.path) { return true }

    let utterance = AVSpeechUtterance(string: text)
    utterance.voice = AVSpeechSynthesisVoice(language: Locale.preferredLanguages.first ?? "en-US") ?? AVSpeechSynthesisVoice(language: "en-US")
    utterance.rate = AVSpeechUtteranceDefaultSpeechRate
    let speaker = AVSpeechSynthesizer()
    synthesizer = speaker
    return await withCheckedContinuation { continuation in
      var file: AVAudioFile?
      var finished = false
      speaker.write(utterance) { buffer in
        guard !finished else { return }
        guard let pcm = buffer as? AVAudioPCMBuffer else { return }
        if pcm.frameLength == 0 {
          // The last, empty buffer: the clip is complete.
          finished = true
          file = nil
          continuation.resume(returning: FileManager.default.fileExists(atPath: target.path))
          return
        }
        do {
          if file == nil { file = try AVAudioFile(forWriting: target, settings: pcm.format.settings, commonFormat: pcm.format.commonFormat, interleaved: pcm.format.isInterleaved) }
          try file?.write(from: pcm)
        } catch {
          finished = true
          continuation.resume(returning: false)
        }
      }
    }
  }

  /// Spoken clips older than two days go.
  private static func clearOld(in folder: URL) {
    let old = Date().addingTimeInterval(-2 * 86400)
    let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.contentModificationDateKey])) ?? []
    for file in files where file.lastPathComponent.hasPrefix(prefix) {
      let date = (try? file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
      if date < old { try? FileManager.default.removeItem(at: file) }
    }
  }
}
