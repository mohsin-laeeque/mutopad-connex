# Connex REPL

[![npm version](https://badge.fury.io/js/%40vechain%2Fconnex-repl.svg)](https://badge.fury.io/js/%40vechain%2Fconnex-repl)

Connex REPL the REPL style command-line playground to try out Connex interface.

## Requirement

It requires NodeJS version >= 10

## Installation

```bash
$ npm i -g @mutopad/connex-repl
```

Startup to connect with local thor node by default (http://localhost:8669/)
```bash
$ connex 
```

or the remote one
```bash
$ connex http://remote-thor-node-api-base-url
```

Then you get a NodeJS REPL interface. e.g.

```bash
VeChain Connex Playground @ http://localhost:8669/
connex v1.3.1
Testnet(100%)> 
```

## Play with it

* Check VeChain status
    ```bash
    Testnet(100%)> thor.status
    ```

* Get newest block
    ```bash
    Testnet(100%)> await thor.block().get()
    ```
* Import private key
    ```bash
    Testnet(100%)> wallet.import('<private key>')
    ```

## License

This package is licensed under the
[GNU Lesser General Public License v3.0](https://www.gnu.org/licenses/lgpl-3.0.html), also included
in *LICENSE* file in the repository.
