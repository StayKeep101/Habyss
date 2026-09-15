require 'xcodeproj'

project_path = 'ios/Habyss.xcodeproj'
project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |t| t.name == 'Habyss Watch App' }
group = project.main_group.find_subpath('Habyss Watch App', true)

# Function to find or create group
def find_or_create_group(parent_group, path_components)
  current_group = parent_group
  path_components.each do |component|
    # If it's a synchronized group, we might not be able to traverse easily.
    # Assuming standard PBXGroup for now, or falling back to creating one.
    next_group = current_group.children.find { |c| c.display_name == component || c.path == component }
    
    if next_group.nil?
      # If we can't find it, we create a new group. 
      # Note: This might duplicate if using synchronized groups incorrectly so use with caution.
      # Ideally we just adds the file to the root if complexity is high.
      next_group = current_group.new_group(component)
    end
    current_group = next_group
  end
  return current_group
end

files = [
  { path: 'Shared/Models/FocusSession.swift', group_path: ['Shared', 'Models'] },
  { path: 'ViewModels/FocusTimerViewModel.swift', group_path: ['ViewModels'] },
  { path: 'Views/FocusTimerView.swift', group_path: ['Views'] }
]

files.each do |file|
  # Start from the main group (Habyss Watch App)
  # Basic approach: Add file reference directly if group structure is complex
  file_ref = group.new_reference(file[:path])
  target.source_build_phase.add_file_reference(file_ref)
  puts "Added #{file[:path]} to target #{target.name}"
end

project.save
puts "Project saved."
