# Ruby script
# install ruby and 
# install this gem "em-websocket"


require 'em-websocket'

@clients = []

EM.run {
	EM::WebSocket.run(:host=>"0.0.0.0", :port=>8090) do |ws|
		ws.onopen{ |handshake|

			puts "New Connection"

			@clients.push ws

			#ws.send("Hello Client, you connected to #{handshake.path}")
		}

		ws.onclose { puts "Connection closed" }

		ws.onmessage { |msg|

			@clients.each do |client| 
			  puts "Received message: #{msg}"
			  client.send msg
			end
		}
	end
}

puts @clients
