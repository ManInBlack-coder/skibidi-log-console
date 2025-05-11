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
        width: DEFAULT_WIDTH, // Akna algne laius
        height: DEFAULT_HEIGHT, // Akna algne kõrgus
        x: width - (DEFAULT_WIDTH + 20), // Akna algne X-koordinaat (paremas servas, 20px äärest)
        y: height - (DEFAULT_HEIGHT + 20), // Akna algne Y-koordinaat (all servas, 20px äärest)
        frame: false, // Eemaldab operatsioonisüsteemi vaikimisi akna raami (tiitliriba, nupud)
        transparent: true, // Muudab akna tausta läbipaistvaks
        alwaysOnTop: true, // Hoiab akna alati teiste akende peal
        resizable: true, // Lubab akna suurust muuta
        hasShadow: true, // Lisab aknale varju (mõju peamiselt macOS-is)
        vibrancy: 'dark', // Määrab akna läbipaistvuse efekti (macOS-i spetsiifiline, nt udune taust)
        visualEffectState: 'active', // Määrab visuaalse efekti oleku (macOS)
        backgroundColor: '#00000000', // Määrab akna taustavärvi, kui 'transparent' on true. Siin täiesti läbipaistev.
        webPreferences: { // Veebisisu (renderdusprotsessi) seaded
            nodeIntegration: true, // Lubab Node.js API-de kasutamist renderdusprotsessis (HTML/JS)
            contextIsolation: false, // Keelab konteksti isoleerimise, potentsiaalne turvarisk, aga lihtsustab mõnda asja
            enableRemoteModule: true // Lubab `@electron/remote` mooduli kasutamist renderdusprotsessis
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

    // Seadista miinimum ja maksimum suurused
    mainWindow.setMinimumSize(300, 200);

    // Jälgi akna suuruse muutumist
    mainWindow.on('will-resize', (event, newBounds) => {
        const workAreaSize = screen.getPrimaryDisplay().workAreaSize;
        const maxWidth = workAreaSize.width - 40;
        const maxHeight = workAreaSize.height - 40;

        // Kontrolli, et aken ei läheks ekraani piiridest välja
        if (newBounds.width > maxWidth) {
            event.preventDefault();
            mainWindow.setSize(maxWidth, newBounds.height);
        }
        if (newBounds.height > maxHeight) {
            event.preventDefault();
            mainWindow.setSize(newBounds.width, maxHeight);
        }

        // Kontrolli, et aken ei läheks vasakule poole
        if (newBounds.x < 0) {
            event.preventDefault();
            mainWindow.setPosition(0, newBounds.y);
        }
    });

    // Jälgi akna liigutamist
    mainWindow.on('will-move', (event, newBounds) => {
        const workAreaSize = screen.getPrimaryDisplay().workAreaSize;
        
        // Kontrolli, et aken ei läheks ekraani piiridest välja
        if (newBounds.x < 0 || 
            newBounds.y < 0 || 
            newBounds.x + newBounds.width > workAreaSize.width || 
            newBounds.y + newBounds.height > workAreaSize.height) {
            event.preventDefault();
        }
    });
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