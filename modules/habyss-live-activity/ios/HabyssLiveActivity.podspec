Pod::Spec.new do |s|
  s.name           = 'HabyssLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Starts, updates and ends the Habyss Live Activity'
  s.description    = 'Local Expo module wrapping ActivityKit for the Habyss widget extension'
  s.author         = ''
  s.homepage       = 'https://habyss.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
