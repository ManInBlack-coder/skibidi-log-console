// Peamine pakett
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const PORT = "9091"

// LogEntry struktuur defineerib logi kirje formaadi
// See peab ühtima kliendipoolse logger.ts formaadiga
type LogEntry struct {
	Level     string    `json:"level"`     // Logi tase (error, warn, info, log)
	Messages  []any     `json:"messages"`  // Logi sõnumid
	Location  string    `json:"location"`  // Kust koodist logi tuli
	Timestamp time.Time `json:"timestamp"` // Logi ajatempel
}

var (
	// WebSocket upgrader konfiguratsioon
	// CheckOrigin lubab ühendusi igalt poolt (arenduse jaoks)
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	// Aktiivsete WebSocket klientide kaart
	clients = make(map[*websocket.Conn]bool)
	// Mutex klientide kaardi threadsafe haldamiseks
	clientsMu sync.Mutex
)

// Kontrolli, kas port on kasutusel ja lõpeta vajadusel vana protsess
func checkAndKillPort() error {
	// Kontrolli, kas port on kasutusel
	conn, err := net.DialTimeout("tcp", fmt.Sprintf(":%s", PORT), time.Second)
	if err != nil {
		// Port ei ole kasutusel
		return nil
	}
	if conn != nil {
		conn.Close()
	}

	// Port on kasutusel, proovime leida ja lõpetada protsessi
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd", "/c", fmt.Sprintf("netstat -ano | findstr :%s", PORT))
	} else {
		cmd = exec.Command("lsof", "-i", fmt.Sprintf(":%s", PORT))
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ei õnnestunud leida protsessi: %v", err)
	}

	// Leia PID
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.Contains(line, "LISTEN") {
			fields := strings.Fields(line)
			if len(fields) > 1 {
				pid := fields[1]
				// Lõpeta protsess
				killCmd := exec.Command("kill", "-9", pid)
				if err := killCmd.Run(); err != nil {
					return fmt.Errorf("ei õnnestunud lõpetada protsessi: %v", err)
				}
				log.Printf("Lõpetati vana protsess PID-ga %s", pid)
				time.Sleep(time.Second) // Oota, et port vabaneks
				return nil
			}
		}
	}

	return fmt.Errorf("ei leitud protsessi, mis kasutab porti %s", PORT)
}

func main() {
	// Kontrolli ja vabasta port
	if err := checkAndKillPort(); err != nil {
		log.Printf("Hoiatus: %v", err)
	}

	// Loo uus Gin server vaikimisi middleware'iga
	r := gin.Default()

	// Lisa CORS (Cross-Origin Resource Sharing) seadistus
	// See võimaldab päringuid localhost:5173 kliendilt
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		// OPTIONS päringute käsitlemine CORS pre-flight jaoks
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Serveeri staatilisi faile /static kataloogist
	r.Static("/static", "./static")
	// Lae HTML mallid templates kataloogist
	r.LoadHTMLGlob("templates/*")

	// Määra marsruudid
	// Pealeht
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", nil)
	})

	// WebSocket endpoint reaalajas logide jaoks
	r.GET("/ws", handleWebSocket)
	// HTTP endpoint logide vastuvõtmiseks
	r.POST("/log", handleLog)

	// Loo pid fail
	pid := os.Getpid()
	if err := os.WriteFile("server.pid", []byte(fmt.Sprintf("%d", pid)), 0644); err != nil {
		log.Printf("Hoiatus: ei õnnestunud luua pid faili: %v", err)
	}

	// Käivita server pordil 8081
	log.Printf("Starting bug tracker server on :%s...", PORT)
	if err := r.Run(":" + PORT); err != nil {
		log.Fatal(err)
	}
}

// handleWebSocket käsitleb WebSocket ühendusi
// See hoiab ühendust avatuna ja lisab kliendi aktiivsete klientide nimekirja
func handleWebSocket(c *gin.Context) {
	// Uuenda HTTP ühendus WebSocket ühenduseks
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}
	defer conn.Close()

	// Lisa klient aktiivsete klientide nimekirja
	clientsMu.Lock()
	clients[conn] = true
	clientsMu.Unlock()

	// Hoia ühendust avatuna ja eemalda klient kui ühendus katkeb
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			clientsMu.Lock()
			delete(clients, conn)
			clientsMu.Unlock()
			break
		}
	}
}

// handleLog võtab vastu logi kirjeid HTTP POST päringutena
// ja edastab need kõigile ühendatud WebSocket klientidele
func handleLog(c *gin.Context) {
	var logEntry LogEntry
	// Parsi JSON päring LogEntry struktuuriks
	if err := c.BindJSON(&logEntry); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Saada logi kõigile ühendatud klientidele
	message, _ := json.Marshal(logEntry)
	clientsMu.Lock()
	for client := range clients {
		if err := client.WriteMessage(websocket.TextMessage, message); err != nil {
			log.Printf("Error sending message to client: %v", err)
			client.Close()
			delete(clients, client)
		}
	}
	clientsMu.Unlock()

	c.Status(http.StatusOK)
}
