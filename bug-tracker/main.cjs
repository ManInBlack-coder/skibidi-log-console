const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const remote = require('@electron/remote/main');

remote.initialize();

let mainWindow;

// Vaikimisi akna suurus
const DEFAULT_WIDTH = 340;
const DEFAULT_HEIGHT = 480;

function createWindow() {
    // Saa ekraani suurus
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    // Loo põhiaken
    mainWindow = new BrowserWindow({
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        x: width - (DEFAULT_WIDTH + 20),
        y: height - (DEFAULT_HEIGHT + 20),
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
        hasShadow: true,
        vibrancy: 'dark',
        visualEffectState: 'active',
        backgroundColor: '#00000000',
        movable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    remote.enable(mainWindow.webContents);

    // Lae HTML fail
    mainWindow.loadFile('templates/index.html');

    // Ära näita menüüd
    mainWindow.setMenuBarVisibility(false);

    // Lisa IPC sõnumite käsitlejad
    ipcMain.on('close-app', () => {
        app.quit();
    });

    ipcMain.on('minimize-app', () => {
        mainWindow.minimize();
    });

    // Lisa taaskäivitamise käsitleja
    ipcMain.on('restart-frontend', () => {
        mainWindow.reload();
    });

    // Seadista miinimum suurus
    mainWindow.setMinimumSize(300, 200);
}

// Kui Electron on valmis, loo aken
app.whenReady().then(() => {
    createWindow();
});

// Sulge rakendus, kui kõik aknad on suletud (macOS-il)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Loo uus aken, kui rakendus aktiveeritakse (macOS-il)
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
}); 