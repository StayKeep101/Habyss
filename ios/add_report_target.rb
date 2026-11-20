# Adds the Screen time report (ios/ScreenTimeReport) to the Xcode project: the
# extension that draws app usage inside Habyss (iOS lets only it see the numbers).
# ios/ is built as is (no prebuild). Safe to run again: it skips what exists.
#   ruby ios/add_report_target.rb   (from the repository root)
require 'xcodeproj'

project = Xcodeproj::Project.open('ios/Habyss.xcodeproj')
app = project.targets.find { |t| t.name == 'Habyss' }
model = project.targets.find { |t| t.name == 'ActivityMonitor' }
embed = app.build_phases.find { |b| b.display_name == 'Embed Foundation Extensions' }
name = 'ScreenTimeReport'

if project.targets.any? { |t| t.name == name }
  puts "#{name}: already there"
else
  target = project.new_target(:app_extension, name, :ios, '16.4', nil, :swift)
  group = project.main_group.find_subpath(name, true)
  group.set_source_tree('<group>')
  group.set_path(name)
  source = group.new_reference('ScreenTimeReportExtension.swift')
  group.new_reference('Info.plist')
  group.new_reference("#{name}.entitlements")
  target.source_build_phase.add_file_reference(source, true)
  %w[DeviceActivity FamilyControls ManagedSettings SwiftUI].each { |framework| target.add_system_framework(framework) }

  target.build_configurations.each do |config|
    from = model.build_configurations.find { |c| c.name == config.name }
    from.build_settings.each do |key, value|
      next if %w[PRODUCT_BUNDLE_IDENTIFIER INFOPLIST_FILE CODE_SIGN_ENTITLEMENTS].include?(key)
      config.build_settings[key] = value
    end
    config.build_settings.merge!(
      'PRODUCT_BUNDLE_IDENTIFIER' => "com.habyss.app.#{name}",
      'INFOPLIST_FILE' => "#{name}/Info.plist",
      'CODE_SIGN_ENTITLEMENTS' => "#{name}/#{name}.entitlements",
    )
  end

  app.add_dependency(target)
  build_file = embed.add_file_reference(target.product_reference, true)
  build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  puts "#{name}: added (com.habyss.app.#{name})"
end

project.save
puts 'Project saved.'
