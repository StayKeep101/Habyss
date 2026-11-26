require 'xcodeproj'

project_path = 'ios/Habyss.xcodeproj'
project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |t| t.name == 'Habyss' }
group = project.main_group.find_subpath('Habyss', true)
modules_group = group.find_subpath('Modules', true)

# Files to move
files = [
  'ScreenTimeModule.swift',
  'ScreenTimeModule.m'
]

files.each do |filename|
  # Remove old reference from root group
  old_ref = group.find_file_by_path(filename)
  if old_ref
    puts "Removing old reference for #{filename}..."
    old_ref.remove_from_project
  end

  # Add new reference to Modules group
  new_path = "Modules/#{filename}"
  new_ref = modules_group.new_reference(filename) # Relative to group path
  target.source_build_phase.add_file_reference(new_ref)
  puts "Added #{new_path} to Modules group and target."
end

project.save
puts "Project saved."
