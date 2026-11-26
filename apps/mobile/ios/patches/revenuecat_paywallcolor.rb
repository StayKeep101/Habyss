# RevenueCat 5.58.0 does not compile under Swift 6.4 / Xcode 27.
#
# PaywallColor declares all of its initializers in extensions, so Swift still
# synthesises the memberwise `init(stringRepresentation:_underlyingColor: = nil)`.
# Because that second parameter is defaulted, the call can be made with only
# `stringRepresentation:`, which is now ambiguous with the public throwing
# `init(stringRepresentation:)`. CustomerCenterConfigData.swift fails to build.
#
# Declaring any initializer in the struct body suppresses the synthesised one.
# Nothing calls the memberwise init, so removing it changes no behaviour.
#
# Pods are gitignored and regenerated, so this runs from the Podfile's
# post_install hook and is safe to run repeatedly.
MARKER = 'habyssMemberwiseSuppressor'

def patch_paywall_color(pods_root)
  file = File.join(pods_root, 'RevenueCat/Sources/Paywalls/PaywallColor.swift')
  return :missing unless File.exist?(file)

  source = File.read(file)
  return :present if source.include?(MARKER)

  anchor = "    fileprivate var _underlyingColor: (any Sendable)?\n"
  return :anchor_missing unless source.include?(anchor)

  addition = anchor + [
    '',
    '    // Suppresses the synthesised memberwise init, whose defaulted',
    '    // `_underlyingColor` makes it ambiguous with the public throwing',
    "    // `init(stringRepresentation:)` under Swift 6.4. Uncallable by design.",
    "    private init(#{MARKER}: Never) {",
    '        self.stringRepresentation = ""',
    '        self._underlyingColor = nil',
    '    }',
    ''
  ].join("\n")

  was_writable = File.writable?(file)
  File.chmod(0o644, file) unless was_writable
  File.write(file, source.sub(anchor, addition))
  :applied
end

if $PROGRAM_NAME == __FILE__
  puts patch_paywall_color(ARGV[0] || 'ios/Pods')
end
