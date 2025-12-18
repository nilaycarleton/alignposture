# Posture Detection System

A real-time posture monitoring application that uses computer vision to detect slouching and provide visual and audio feedback to help improve sitting posture.

## Overview

This project was developed as a high school grade 12 computer science project to address poor posture habits during long computer usage sessions. The system uses your webcam to monitor your posture in real-time and provides escalating warnings when slouching is detected.

## Features

- **Real-time pose detection** using MediaPipe
- **Visual feedback system** with color-coded borders:
  - 🟢 Green: Good posture
  - 🟡 Yellow: Slouching detected for 1+ minute
  - 🔴 Red: Slouching detected for 2+ minutes (with audio warning)
- **Audio alerts** when prolonged slouching is detected
- **Data logging** to CSV for tracking posture over time
- **Live visualization** with matplotlib showing posture metrics
- **Body landmark heatmap** overlay for visual feedback

## Technologies Used

- **Python** - Main application logic
- **C++** - Distance calculation and slouch detection functions (compiled to shared library)
- **OpenCV** - Image processing and display
- **MediaPipe** - Pose estimation and landmark detection
- **SFML** - Audio handling (C++)
- **Pygame** - Audio playback (Python)
- **Pandas & Matplotlib** - Data analysis and visualization

## Requirements

### Python Dependencies
```
opencv-python
mediapipe
numpy
pygame
pandas
matplotlib
```

### C++ Dependencies
- OpenCV
- SFML Audio

### System Requirements
- Webcam
- Linux/Unix system (for `.so` shared library)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/posture-detection.git
cd posture-detection
```

2. Install Python dependencies:
```bash
pip install opencv-python mediapipe numpy pygame pandas matplotlib
```

3. Compile the C++ shared library:
```bash
g++ -shared -o libdistance.so -fPIC distance.cpp -lsfml-audio `pkg-config --cflags --libs opencv4`
```

4. Add a warning sound file named `warning.wav` to the project directory

## Usage

Run the main Python script:
```bash
python main.py
```

The application will:
1. Open your webcam
2. Display a window with your pose landmarks
3. Monitor your posture continuously
4. Show real-time distance metrics
5. Display color-coded border warnings
6. Log data to `posture_data.csv`
7. Update a live plot of your posture over time

Press `ESC` to exit the application.

## How It Works

1. **Pose Detection**: MediaPipe identifies body landmarks including shoulders, hips, and elbows
2. **Distance Calculation**: The C++ library calculates the 3D distance between key body points
3. **Slouch Detection**: Compares calculated distances against a threshold to determine if you're slouching
4. **Warning System**: 
   - No slouching: Green border
   - 1 minute of slouching: Yellow border
   - 2 minutes of slouching: Red border + audio alert + text reminders
5. **Data Logging**: Timestamps and posture metrics are saved for later analysis

## Project Structure

```
.
├── main.py                 # Main Python application
├── distance.cpp           # C++ distance calculation functions
├── main.cpp              # C++ standalone implementation
├── libdistance.so        # Compiled shared library
├── warning.wav           # Warning sound file
├── posture_data.csv      # Generated log file
└── README.md            # This file
```

## Customization

You can adjust the slouch detection threshold in `main.py`:
```python
threshold = 0.50  # Increase for more lenient detection, decrease for stricter
```

Timing for warnings can be modified:
- Yellow warning: Change `60` seconds on line checking `current_time - start_time > 60`
- Red warning: Change `120` seconds on line checking `current_time - start_time > 120`

## Contributors

This project was developed by three Grade 12 high school students as a computer science project.

## License

This project is open source and available under the MIT License.

## Acknowledgments

- MediaPipe team for the pose detection library
- OpenCV community for computer vision tools
- Our teachers and peers for feedback and support

## Future Improvements

- [ ] Cross-platform support (Windows, macOS)
- [ ] Calibration system for different body types
- [ ] Mobile app version
- [ ] Configurable warning thresholds via GUI
- [ ] Weekly/monthly posture reports
- [ ] Exercise suggestions for posture improvement
