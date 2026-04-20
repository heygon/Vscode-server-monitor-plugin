import * as vscode from 'vscode';
import { Client, ClientChannel } from 'ssh2';
import { SshServerConfig } from './types';

export class SshPseudoterminal implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>();
  private readonly closeEmitter = new vscode.EventEmitter<number | void>();

  public readonly onDidWrite: vscode.Event<string> = this.writeEmitter.event;
  public readonly onDidClose?: vscode.Event<number | void> = this.closeEmitter.event;

  private client: Client | undefined;
  private shellStream: ClientChannel | undefined;
  private isClosed = false;

  constructor(
    private readonly config: SshServerConfig,
    private readonly password: string,
  ) {}

  open(initialDimensions: vscode.TerminalDimensions | undefined): void {
    this.connect(initialDimensions);
  }

  close(): void {
    this.isClosed = true;
    this.disposeConnection();
  }

  handleInput(data: string): void {
    if (this.shellStream) {
      this.shellStream.write(data);
    }
  }

  setDimensions(dimensions: vscode.TerminalDimensions): void {
    if (this.shellStream) {
      this.shellStream.setWindow(dimensions.rows, dimensions.columns, 0, 0);
    }
  }

  private connect(initialDimensions: vscode.TerminalDimensions | undefined): void {
    this.writeEmitter.fire(`Conectando em ${this.config.username}@${this.config.host}:${this.config.port}...\r\n`);

    const client = new Client();
    this.client = client;

    client.on('ready', () => {
      if (this.isClosed) {
        this.disposeConnection();
        return;
      }

      this.writeEmitter.fire('Conexao SSH estabelecida.\r\n\r\n');

      client.shell(
        {
          term: 'xterm-256color',
          cols: initialDimensions?.columns || 120,
          rows: initialDimensions?.rows || 30,
        },
        (err, stream) => {
          if (err) {
            this.writeEmitter.fire(`Falha ao abrir shell remota: ${err.message}\r\n`);
            this.closeEmitter.fire(1);
            this.disposeConnection();
            return;
          }

          this.shellStream = stream;

          stream.on('data', (chunk: Buffer) => {
            this.writeEmitter.fire(chunk.toString('utf8'));
          });

          stream.stderr.on('data', (chunk: Buffer) => {
            this.writeEmitter.fire(chunk.toString('utf8'));
          });

          stream.on('close', () => {
            this.writeEmitter.fire('\r\nSessao SSH finalizada.\r\n');
            this.closeEmitter.fire(0);
            this.disposeConnection();
          });
        },
      );
    });

    client.on('error', (err) => {
      this.writeEmitter.fire(`Erro SSH: ${err.message}\r\n`);
      this.closeEmitter.fire(1);
      this.disposeConnection();
    });

    client.on('close', () => {
      if (!this.isClosed && this.shellStream) {
        this.writeEmitter.fire('\r\nConexao encerrada.\r\n');
      }
      this.disposeConnection();
    });

    client.connect({
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      password: this.password,
      readyTimeout: 20000,
      keepaliveInterval: 30000,
      keepaliveCountMax: 3,
    });
  }

  private disposeConnection(): void {
    if (this.shellStream) {
      try {
        this.shellStream.close();
      } catch {
        // ignore shutdown errors
      }
      this.shellStream = undefined;
    }

    if (this.client) {
      try {
        this.client.end();
      } catch {
        // ignore shutdown errors
      }
      this.client = undefined;
    }
  }
}
