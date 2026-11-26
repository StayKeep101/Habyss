require 'xcodeproj'

project_path = 'ios/Habyss.xcodeproj'
project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |t| t.name == 'Habyss' }
group = project.main_group.find_subpath('Habyss', true)

# Create Managers group if needed
managers_group = group.find_subpath('Managers', true)
views_group = group.find_subpath('Views', true)

files = [
  { path: 'Managers/ScreenTimeManager.swift', group: managers_group },
  { path: 'Views/ScreenTimePickerView.swift', group: views_group },
  { path: 'ScreenTimeModule.swift', group: group },
  { path: 'ScreenTimeModule.m', group: group }
]

files.each do |file|
  # Remove existing reference if any to avoid dupes
  existing = file[:group].find_file_by_path(File.basename(file[:path]))
  existing.remove_from_project if existing

  # Add new reference
  file_ref = file[:group].new_reference(file[:path])
  target.source_build_phase.add_file_reference(file_ref)
  puts "Added #{file[:path]} to target #{target.name}"
end

project.save
puts "Project saved."
