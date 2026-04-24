require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'WatchConnectivity'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.authors        = { 'KnowYourPit' => 'support@knowyourpit.com' }
  s.homepage       = 'https://knowyourpit.com'
  s.platform       = :ios, '15.1'
  s.swift_version  = '5.4'
  s.source         = { path: '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "ios/**/*.{h,m,mm,swift,hpp,cpp}"

  s.frameworks = ['WatchConnectivity']
end
