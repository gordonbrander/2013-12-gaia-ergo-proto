This prototype is designed to test the ergonomics of swipe gestures on-device
for FirefoxOS.

Running
-------

Run a local server (requires `python` in `PATH`):

    make server

Install as app by navigating to your computer's local IP address, port 8000 in
the Firefox OS Browser app. Network Activity is a good way to get this info.
For example:

    http://192.168.16.80:8000/install.html

This will install the app locally and full-screen. Note that if your computer's
local IP changes, you will have to re-install.
