This git contains the code for the Sirin Labs binance voting count.
At the end of the voting the server will count the votes made to the Sirin Labs voting contract:
https://github.com/sirin-labs/voting-smart-contract

The counting is made by proove of stack, each voting address has the weight of its SRN balance at the time of the voting closing block from the total stack of voters.
The server is also verifing no double votes are made.

1.npm i

2.fill .env file with your custom params

3.npm start

index = percent of yes

:blockNumber = percent of yes to current block
