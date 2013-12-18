This prototype is designed to test the ergonomics of swipe gestures on-device
for FirefoxOS.

Installing
----------

1.  Open Firefox Nightly
2.  Open `about:app-manager`
3.  Go to Apps
4.  Add app at `http://gordonbrander.github.io/2013-12-gaia-ergo-proto/manifest.webapp`
5.  Enable remote debugging on your phone. Plug it in.
6.  Connect to your phone from `about:app-manager`.
7.  Hit `update` button for app. This will install app on phone.


Running Locally
---------------

Run a local server (requires `python` in `PATH`):

    make server

How to install as app:

1.  Open Firefox Nightly
2.  Open `about:app-manager`
3.  Go to Apps
4.  Find URL to manifest on your computer's local IP address, port 800.
    Network Activity is a good way to get this info. For example:
    `http://192.168.16.80:8000/manifest.webapp`. Add app at the address.
5.  Enable remote debugging on your phone. Plug it in.
6.  Connect to your phone from `about:app-manager`.
7.  Hit `update` button for app. This will install app on phone.

This will install the app locally and full-screen. You can remotely debug the
app using the app manager. Note that if your computer's
local IP changes, you will have to re-install.
