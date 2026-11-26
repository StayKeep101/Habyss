# Takes the Screen time report (ios/ScreenTimeReport) out of the build while its
# Apple app ID lacks the Family Controls capability. Its files stay; put it back
# with: ruby ios/add_report_target.rb   (from the repository root)
require 'xcodeproj'

project = Xcodeproj::Project.open('ios/Habyss.xcodeproj')
app = project.targets.find { |t| t.name == 'Habyss' }
report = project.targets.find { |t| t.name == 'ScreenTimeReport' }
unless report
  puts 'ScreenTimeReport: not in the project'
  exit
end
app.dependencies.select { |d| d.target == report }.each(&:remove_from_project)
app.build_phases.each do |phase|
  next unless phase.respond_to?(:files)
  phase.files.select { |f| f.file_ref == report.product_reference }.each(&:remove_from_project)
end
report.product_reference&.remove_from_project
report.remove_from_project
group = project.main_group.children.find { |c| c.respond_to?(:path) && c.path == 'ScreenTimeReport' }
group&.remove_from_project
project.save
puts 'ScreenTimeReport: removed from the build (files kept)'
