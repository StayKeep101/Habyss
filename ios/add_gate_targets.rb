# Adds "Earn your scroll"'s three Screen Time extensions to the Xcode project
# (ios/ is built as is: no prebuild). Safe to run again: it skips what exists.
#   ruby ios/add_gate_targets.rb   (from the repository root)
require 'xcodeproj'

project = Xcodeproj::Project.open('ios/Habyss.xcodeproj')
app = project.targets.find { |t| t.name == 'Habyss' }
widget = project.targets.find { |t| t.name == 'WidgetExtension' }
embed = app.build_phases.find { |b| b.display_name == 'Embed Foundation Extensions' }

# The rule every target shares, compiled into the app too.
gate_group = project.main_group.find_subpath('Gate', true)
gate_group.set_source_tree('<group>')
gate_group.set_path('Gate')
shared = gate_group.files.find { |f| f.path == 'GateShared.swift' } || gate_group.new_reference('GateShared.swift')
app.source_build_phase.add_file_reference(shared, true) unless app.source_build_phase.files_references.include?(shared)

EXTENSIONS = [
  { name: 'ShieldConfiguration', file: 'ShieldConfigurationExtension.swift', frameworks: %w[ManagedSettings ManagedSettingsUI FamilyControls] },
  { name: 'ShieldAction', file: 'ShieldActionExtension.swift', frameworks: %w[ManagedSettings FamilyControls UserNotifications] },
  { name: 'ActivityMonitor', file: 'ActivityMonitorExtension.swift', frameworks: %w[DeviceActivity ManagedSettings FamilyControls] },
].freeze

# Copied from the widget so every extension builds and signs the same way.
COPIED = %w[CLANG_ANALYZER_NONNULL CLANG_CXX_LANGUAGE_STANDARD CLANG_ENABLE_OBJC_WEAK CODE_SIGN_STYLE CURRENT_PROJECT_VERSION
            DEVELOPMENT_TEAM GCC_C_LANGUAGE_STANDARD LD_RUNPATH_SEARCH_PATHS MARKETING_VERSION SWIFT_VERSION TARGETED_DEVICE_FAMILY].freeze

EXTENSIONS.each do |spec|
  name = spec[:name]
  if project.targets.any? { |t| t.name == name }
    puts "#{name}: already there"
    next
  end
  target = project.new_target(:app_extension, name, :ios, '16.4', nil, :swift)
  group = project.main_group.find_subpath(name, true)
  group.set_source_tree('<group>')
  group.set_path(name)
  source = group.new_reference(spec[:file])
  group.new_reference('Info.plist')
  group.new_reference("#{name}.entitlements")
  target.source_build_phase.add_file_reference(source, true)
  target.source_build_phase.add_file_reference(shared, true)
  spec[:frameworks].each { |framework| target.add_system_framework(framework) }

  target.build_configurations.each do |config|
    from = widget.build_configurations.find { |c| c.name == config.name }
    COPIED.each { |key| config.build_settings[key] = from.build_settings[key] if from.build_settings.key?(key) }
    config.build_settings.merge!(
      'PRODUCT_BUNDLE_IDENTIFIER' => "com.habyss.app.#{name}",
      'PRODUCT_NAME' => '$(TARGET_NAME)',
      'INFOPLIST_FILE' => "#{name}/Info.plist",
      'GENERATE_INFOPLIST_FILE' => 'YES',
      'INFOPLIST_KEY_CFBundleDisplayName' => 'Habyss',
      'CODE_SIGN_ENTITLEMENTS' => "#{name}/#{name}.entitlements",
      'IPHONEOS_DEPLOYMENT_TARGET' => '16.4',
      'SKIP_INSTALL' => 'YES',
      'SWIFT_EMIT_LOC_STRINGS' => 'YES',
      'APPLICATION_EXTENSION_API_ONLY' => 'YES',
    )
  end

  app.add_dependency(target)
  build_file = embed.add_file_reference(target.product_reference, true)
  build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  puts "#{name}: added (com.habyss.app.#{name})"
end

project.save
puts 'Project saved.'
