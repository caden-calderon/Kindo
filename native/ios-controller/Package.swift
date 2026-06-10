// swift-tools-version: 5.10

import PackageDescription

let package = Package(
  name: "KindoIOSController",
  platforms: [
    .iOS(.v17),
    .macOS(.v14),
  ],
  products: [
    .library(name: "KindoIOSControllerCore", targets: ["KindoIOSControllerCore"]),
  ],
  targets: [
    .target(
      name: "KindoIOSControllerCore",
      path: "Sources/KindoIOSControllerCore"
    ),
    .testTarget(
      name: "KindoIOSControllerTests",
      dependencies: ["KindoIOSControllerCore"],
      path: "Tests/KindoIOSControllerTests"
    ),
  ]
)
