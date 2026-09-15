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

  var contentState: WidgetAttributes.ContentState {
    WidgetAttributes.ContentState(
      title: title,
      subtitle: subtitle,
      timerEndDateInMilliseconds: timerEndDateInMilliseconds,
      progress: progress,
      profileImagePath: profileImagePath
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

public class HabyssLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HabyssLiveActivity")

    Function("areActivitiesEnabled") { () -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      return ActivityAuthorizationInfo().areActivitiesEnabled
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
