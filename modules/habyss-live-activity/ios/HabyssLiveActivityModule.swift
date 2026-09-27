import ActivityKit
import ExpoModulesCore

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

final class LiveActivitiesUnavailableException: Exception {
  override var reason: String {
    "Live Activities require iOS 16.2 or later"
  }
}

final class ActivityNotFoundException: GenericException<String> {
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
}

public class HabyssLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HabyssLiveActivity")

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
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { return ["scheduled": 0, "failed": plans.count] }
      var scheduled = 0
      var failed = 0
      for plan in plans {
        let name = "scheduled:" + plan.key
        let end = Date(timeIntervalSince1970: plan.end / 1000)
        guard end > Date() else { continue }
        let state = WidgetAttributes.ContentState(
          title: plan.title, subtitle: "Your time, your next step.", timerEndDateInMilliseconds: nil,
          progress: 0, profileImagePath: nil, scheduledStartDateInMilliseconds: plan.start,
          scheduledEndDateInMilliseconds: plan.end, url: plan.url, accentHex: plan.accentHex)
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
            } else { continue }
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
