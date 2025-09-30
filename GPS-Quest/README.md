# 🧭 GPS Quest - Real-World Step-by-Step Quest Template

> 🇺🇸 **English** | [🇺🇦 Українська](README_UA.md)

Open-source location-based quest template for Snapchat Spectacles that guides users through physical locations in a step-by-step adventure.

> **Part of the [Spectacles Projects](../) collection by Pavlo Tkachenko**

## 📍 Overview

GPS Quest v1.0 is a **real-world quest template** that creates location-based adventures where users must physically travel between GPS waypoints to progress. Unlike traditional navigation apps, this template focuses on **step-by-step quest progression** - users see only their next target location, encouraging exploration and discovery.

**Key Concept**: Users travel from location to location in the real world, with each waypoint unlocking the next step in their quest journey.

## ✨ Quest Features

### 🚶‍♂️ **Step-by-Step Progression**
- **Hidden future waypoints**: Users see only completed (green) and next active waypoint
- **Animated reveals**: New waypoints appear with smooth bounce animation when unlocked
- **Progressive unlocking**: Completing one location reveals the next with visual feedback
- **Quest-like experience**: Builds anticipation and encourages exploration without spoilers

### 🌍 **Physical Location Travel**
- **Real-world movement**: Users must physically travel between locations
- **Location-based activation**: Waypoints activate when users arrive on-site
- **Outdoor adventures**: Perfect for city tours, scavenger hunts, and educational trails

### 🎯 **GPS Signal Considerations**
- **Large activation zones** (12-50+ meters): Compensates for GPS signal variations
- **Real-time accuracy circle**: Dynamic visual representation of GPS signal quality
- **Enhanced accuracy display**: 2x scale factor for more realistic visual representation
- **Signal quality aware**: Works reliably even with moderate GPS accuracy
- **Development friendly**: GPS accuracy works in Lens Studio Editor for easier testing
- **Outdoor optimized**: Best performance in open areas with clear sky view

### 🔧 **Custom Logic Support**
- **Waypoint-specific interactions**: Add unique logic at each location
- **Custom prefab system**: Different 3D objects for different waypoint types
- **Extensible framework**: Easy to add mini-games, puzzles, or information displays

### 🧭 **AR Guidance System**
- **3D directional arrow**: Points toward next quest objective
- **Smooth animations**: Tween-based waypoint state transitions
- **Visual feedback**: Clear indication of progress and completion

### 🗺️ **Quest Progress Visualization**
- **Circular minimap**: Shows current location and revealed waypoints
- **Real-time GPS accuracy circle**: Dynamic visual representation of GPS signal quality with 2x scale factor for realistic representation
- **Color-coded waypoint states**:
  - 🟢 **Green pins**: Completed/visited waypoints (automatic material cloning)
  - 📍 **Regular pins**: Current active target
  - ⚫ **Hidden pins**: Future waypoints (invisible until unlocked)
- **Smooth animations**: Waypoints appear with elastic bounce effect when revealed
- **Performance optimized**: Efficient update loops for smooth real-time operation

## 🚀 Quick Start

### 📹 Video Tutorial

Watch the [video tutorial](GPS%20Quest%20Tutorial.mov) for a quick walkthrough of the template features and setup.

### Prerequisites
- Lens Studio 5.12.1 or later
- Snapchat Spectacles (2024)
- Outdoor locations with clear GPS reception
- Basic knowledge of Lens Studio and TypeScript

### Creating Your Quest

1. **Open the Project**
   - Launch Lens Studio
   - Open `GPS Quest v1_0.esproj`

2. **Design Your Quest Route**
   - Plan physical locations users will visit
   - Consider GPS signal quality at each location
   - Ensure locations are accessible and safe

3. **Configure Quest Waypoints**
   - Select the `ManualPlaceList` component
   - Add GPS coordinates (latitude/longitude) for each quest location
   - Set **large activation distances** (15-50 meters recommended)
   - Order waypoints for logical quest progression

4. **Customize Location Interactions**
   - Default prefab: `placePrefab` in WorldController for regular waypoints
   - Special prefab: `firstLastPrefab` for start/finish locations (automatically used when labels contain "START" or "FINISH")
   - Individual prefabs: Enable `useCustomPrefab` for unique location experiences
   - **Important**: Label your first waypoint "START" and last waypoint "FINISH" to trigger special prefabs

5. **Test Your Quest**
   - Use Lens Studio preview with GPS simulation for basic testing
   - **Critical**: Test on actual Spectacles at real locations for GPS accuracy
   - Adjust activation zones based on signal quality at each location

## 🏗️ Architecture

### Core Components

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| **WorldController** | 3D waypoint spawning & animations | Tween states, custom prefabs, GPS positioning |
| **ManualPlaceList** | GPS waypoint management | Coordinate input, custom prefab support |
| **ARNavigation** | Directional arrow guidance | Smooth rotation, auto-switching |
| **MapComponent** | Minimap display | GPS tiles, user position, waypoint pins |
| **PanelManager** | Map initialization | Layer setup, circular rendering |

### Waypoint States
- **🟡 onSpawn**: Next waypoint to visit (yellow indicator)
- **🟢 onVisited**: Currently active waypoint (green indicator)
- **⚪ onPassed**: Previously completed waypoints (gray indicator)

## 🛠️ Customization

### Adding Waypoints

**Important**: Always label your first waypoint as **"START"** and your last waypoint as **"FINISH"** to ensure they use the correct special prefabs (`firstLastPrefab` in WorldController).

<img src="../ManualPlaceList.png" alt="Manual Place List Configuration" width="25%">

### Custom Prefab System
Each waypoint can have its own 3D prefab:
1. Enable `useCustomPrefab` in waypoint settings
2. Assign `customPrefab` ObjectPrefab
3. WorldController will use custom prefab instead of default

### Waypoint Event System
Each waypoint triggers multiple events that can be connected to Tween components for custom animations:

#### Available Events:
- **`onSpawn`** - Triggered when waypoint becomes the next target (yellow indicator)
- **`onVisited`** - Triggered when waypoint is currently active/being visited (green indicator)
- **`onPassed`** - Triggered when waypoint is completed and user moves to next location (gray indicator)

#### Event Integration:
1. **TweenController Setup**: Each waypoint prefab includes child TweenController object
2. **Custom Animations**: Connect events to different tween animations:
   - Reveal effects when waypoint spawns (`onSpawn`)
   - Completion effects (particles, scale bounce) on `onVisited`
   - Fade/minimize animations when `onPassed`
3. **Automatic Triggering**: Events fire automatically when waypoint state changes in WorldController

#### Example Use Cases:
- **Waypoint Reveal**: Scale-in animation with elastic bounce on `onSpawn`
- **Active State**: Pulsing glow or highlight effect on `onVisited`
- **Completion**: Fade to gray and scale down on `onPassed`
- **Sound Effects**: Audio cues connected to each state transition

### Measurement Systems
- **Metric**: Meters and kilometers
- **US**: Feet and miles


## 📝 Documentation

All scripts include comprehensive documentation with:
- Purpose and functionality explanations
- Cleanup notes from original Navigation Kit
- Usage examples and integration points
- Author attribution and modification notes

## 🤝 Contributing

This is an open-source project. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on Spectacles hardware
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 👨‍💻 Author

**Pavlo Tkachenko**
- Website: [pavlotkachenko.com](https://pavlotkachenko.com)
- Based on Snap Inc.'s Navigation Kit template

## 🙏 Acknowledgments

- **Snap Inc.** for the original Navigation Kit template
- **Snapchat Spectacles Team** for the amazing AR platform
- **Community** for feedback and contributions

## 📱 Compatibility

- **Lens Studio**: 5.12.1+
- **Spectacles**: 2024 model
- **Target**: Outdoor GPS navigation experiences

---

⭐ If this template helps your project, please consider giving it a star!