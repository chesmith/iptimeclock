# Build and Deploy Workflow
_Below, replace \<user\> with your repository account name and \<version\> with the appropriate version of the app build._

## Get the code from GitHub
You'll need to first get the code from GitHub and install the Node modules.
```bash
mkdir src
cd src
git clone https://github.com/<user>/iptimeclock.git
cd iptimeclock
npm install
```

## Requirement for packaging on the RPi
The Node package used to build the app, electron-builder, requires the mksquashfs tool to create the application package on Linux (i.e. Raspbian), but doesn't currently come with a version compatible with the Raspberry Pi's arm7l architecture. So, you're going to have to build and install it yourself.

```bash
cd /usr/src
sudo git clone https://git.kernel.org/pub/scm/fs/squashfs/squashfs-tools.git
cd squashfs-tools/squashfs-tools 
sudo make install 
```

This will have built and installed squashfs-tools.  Now we need to manually create a symbolic link to mksquashfs in the electron-builder's cache.

```bash
mkdir -p  ~/.cache/electron-builder/appimage/appimage-9.1.0/linux-arm
cd ~/.cache/electron-builder/appimage/appimage-9.1.0/linux-arm
ln -s /usr/local/bin/mksquashfs mksquashfs
```

## Build, package, and install the app
The app's package.json contains a command for building and packaging the app, called "build".
```bash
npm run build
```
If you're also wanting to install the newly build and packaged app...
```bash
cp "dist/iptimeclock <version> arm7l.AppImage" ~/iptimeclock
./iptimeclock
```
The last line above will launch the app for the first time.  The RPi will display a prompt, the buttons for which will not likely be visible - just hit Enter.

## Application changes
The application supports automatic updates using the electron-updater Node package.  When making application changes, you'll need to follow the below steps to properly build, package, and deploy new releases for the updater to retrieve.

### Setup
You'll need to ensure the package.json is configured with your GitHub repository name and that you have an environment variable set up with your GitHub API token.

#### package.json
```json
  "build": {
    "publish": [
      {
        "provider": "github",
        "owner": "<user>",
        "repo": "iptimeclock"
      }
    ],
```

#### GH_TOKEN environment variable
1. Create a [personal access token](https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line) on GitHub
2. Assign this token to an environment variable named GH_TOKEN
    1. Raspberry Pi: add to .bashrc
        ```bash
        export GH_TOKEN="\<token\>"
        ```
    2. [Windows](https://www.howtogeek.com/51807/how-to-create-and-use-global-system-environment-variables/)

### Update version, build, and deploy
1. Modify the version number in package.json (recommend you use [semantic versioning](https://semver.org/))
2. On Windows, confirm the project builds successfully
    ```bash
    npm run build
    ```
2. Commit to Git and push to GitHub
3. On Windows, build and publish to a draft release on GitHub 
    ```bash
    npm run publish
    ```
4. On the Raspberry Pi, pull latest from the repo, build, and publish to the draft release
    ```bash
    git pull
    npm run publish
    ```
5. On GitHub, publish the draft release

## Useful Tools
### FileZilla
[FileZilla](https://filezilla-project.org/) is an FTP/SFTP client and is used to transfer files between your computer to the RPi.

### SSH
