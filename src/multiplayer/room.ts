import { PRACTICE } from './practice';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { TRACKS } from '../game/tracks';
import { peerOptions } from './config';
import { NetworkRace } from './race';
import {
  cleanName,
  defaultRacerName,
  COLORS,
  encodeMessage,
  MAX_RACERS,
  parseMessage,
  roomCode,
  validCode,
  validTrack,
  VERSION,
  type Member,
  type Message,
} from './protocol';

type Phase = 'idle' | 'connecting' | 'lobby' | 'loading' | 'racing';
interface Connection {
  channel: DataConnection;
  slot?: number;
  seen: number;
  opened: number;
  ready: boolean;
  messages: number;
  window: number;
}
export class Room {
  phase: Phase = 'idle';
  host = false;
  code = '';
  slot = 0;
  track = 0;
  pickups = true;
  members: Member[] = [];
  race?: NetworkRace;
  practice?: NetworkRace;
  riding: number[] = [];
  ping = 0;
  signalingConnected = false;
  onChange: () => void = () => {};
  onRace: (race: NetworkRace) => void = () => {};
  onEnd: (reason: string) => void = () => {};
  private peer?: Peer;
  private connections = new Map<string, Connection>();
  private timer?: ReturnType<typeof setInterval>;
  private generation = 0;
  private raceId = 0;
  private since = 0;
  private lastSnapshot = 0;

  async open(host: boolean, name: string, code = '') {
    this.close();
    const generation = this.generation;
    this.host = host;
    this.code = host ? roomCode() : code.trim().toUpperCase();
    if (!validCode(this.code)) {
      this.onEnd('Enter the eight-character room code.');
      return;
    }
    this.phase = 'connecting';
    this.since = performance.now();
    this.onChange();
    this.timer = setInterval(() => this.heartbeat(), 1000);
    try {
      const [{ default: Peer }, options] = await Promise.all([import('peerjs'), peerOptions()]);
      if (generation !== this.generation) return;
      const peer = new Peer(
        host ? `vectide-v${VERSION}-${this.code}` : `vectide-guest-${crypto.randomUUID()}`,
        options,
      );
      this.peer = peer;
      peer.on('open', () => {
        if (this.peer !== peer) return;
        this.signalingConnected = true;
        // Reopening signaling must not replace the roster or create a second host link.
        if (this.phase !== 'connecting') {
          this.onChange();
          return;
        }
        if (host) {
          this.slot = 0;
          this.members = [
            { slot: 0, name: cleanName(name, defaultRacerName(0)), color: 0, connected: true },
          ];
          this.phase = 'lobby';
          this.publishLobby();
        } else {
          const channel = peer.connect(`vectide-v${VERSION}-${this.code}`, {
            reliable: true,
            serialization: 'json',
            label: 'vectide-v1',
          });
          this.attach(channel, cleanName(name));
        }
      });
      peer.on('connection', (channel) => {
        if (this.peer !== peer) {
          channel.close();
          return;
        }
        if (
          !host ||
          this.phase !== 'lobby' ||
          this.connections.size >= MAX_RACERS - 1 ||
          this.connections.has(channel.peer)
        ) {
          // Wait for open so the rejection is delivered before closing the channel.
          const timer = setTimeout(() => channel.close(), 3000);
          channel.on('error', () => {
            clearTimeout(timer);
            channel.close();
          });
          channel.on('open', () => {
            channel.send({
              type: 'reject',
              reason: !host
                ? 'Connect through the room host.'
                : this.phase !== 'lobby'
                  ? 'This race has already started.'
                  : 'This room is full (10 racers).',
            });
            clearTimeout(timer);
            setTimeout(() => channel.close(), 300);
          });
          return;
        }
        this.attach(channel);
      });
      peer.on('error', (error) => {
        if (this.peer !== peer) return;
        // Signaling can fail while established WebRTC data channels remain healthy.
        if (
          this.phase !== 'connecting' &&
          ['network', 'server-error', 'socket-error', 'socket-closed', 'unavailable-id'].includes(
            error.type,
          )
        )
          return;
        const reasons: Record<string, string> = {
          'peer-unavailable':
            'Room not found. Check the code and ask the host to keep the room open.',
          'unavailable-id': 'That room code is in use. Create a new room.',
          'browser-incompatible': 'This browser does not support WebRTC multiplayer.',
        };
        this.close(reasons[error.type] ?? 'Connection failed. Try again or use another network.');
      });
      peer.on('disconnected', () => {
        if (this.peer !== peer) return;
        this.signalingConnected = false;
        this.onChange();
      });
      peer.on('close', () => {
        if (this.peer === peer) this.close('The room connection closed.');
      });
    } catch (error) {
      if (generation === this.generation)
        this.close(error instanceof Error ? error.message : 'Could not connect. Try again.');
    }
  }
  private attach(channel: DataConnection, name?: string) {
    const connection: Connection = {
      channel,
      seen: performance.now(),
      opened: performance.now(),
      ready: false,
      messages: 0,
      window: performance.now(),
    };
    this.connections.set(channel.peer, connection);
    channel.on('open', () => {
      if (!this.connections.has(channel.peer)) return;
      if (!this.host) this.send(connection, { type: 'join', version: VERSION, name: name! });
    });
    channel.on('data', (raw) => {
      if (this.connections.get(channel.peer) !== connection) return;
      const now = performance.now();
      if (now - connection.window >= 1000) {
        connection.window = now;
        connection.messages = 0;
      }
      if (++connection.messages > 100) {
        this.drop(connection);
        return;
      }
      const message = parseMessage(raw);
      if (!message) return;
      connection.seen = now;
      this.receive(connection, message);
    });
    channel.on('close', () => this.drop(connection));
    channel.on('error', () => this.drop(connection));
  }
  private send(connection: Connection, message: Message, transient = false) {
    const channel = connection.channel;
    if (!channel.open) return;
    // Never grow a stale snapshot queue on a congested data channel.
    if (transient && channel.dataChannel.bufferedAmount > 128 * 1024) return;
    if (!transient && channel.dataChannel.bufferedAmount > 256 * 1024) {
      this.drop(connection);
      return;
    }
    try {
      channel.send(encodeMessage(message));
    } catch {
      this.drop(connection);
    }
  }
  private receive(connection: Connection, message: Message) {
    if (message.type === 'ping') {
      this.send(connection, { type: 'pong', at: message.at });
      return;
    }
    if (message.type === 'pong') {
      this.ping = Math.max(0, Math.round(performance.now() - message.at));
      return;
    }
    if (this.host) {
      if (message.type === 'join' && this.phase === 'lobby' && connection.slot === undefined) {
        if (message.version !== VERSION) {
          this.send(connection, {
            type: 'reject',
            reason: 'Game versions differ. Reload both browsers.',
          });
          return;
        }
        const slot = Array.from({ length: MAX_RACERS - 1 }, (_, i) => i + 1).find(
          (s) => !this.members.some((m) => m.slot === s),
        );
        if (slot === undefined) {
          this.drop(connection);
          return;
        }
        connection.slot = slot;
        this.members.push({
          slot,
          name: cleanName(message.name, defaultRacerName(slot)),
          color: slot,
          connected: true,
        });
        this.publishLobby();
      }
      if (connection.slot === undefined) return;
      if (message.type === 'ride' && this.phase === 'lobby') {
        this.updateRiding(connection.slot, message.active);
      }
      if (
        message.type === 'profile' &&
        this.phase === 'lobby' &&
        !this.riding.includes(connection.slot)
      ) {
        const member = this.members.find((m) => m.slot === connection.slot)!;
        Object.assign(member, {
          name: cleanName(message.name, defaultRacerName(member.slot)),
          color: message.color,
        });
        this.publishLobby();
      }
      if (message.type === 'ready' && message.race === this.raceId && this.phase === 'loading') {
        connection.ready = true;
        this.beginWhenReady();
      }
      if (message.type === 'input' && message.race === 0 && this.phase === 'lobby')
        this.practice?.receiveInput(connection.slot, message.commands);
      if (message.type === 'input' && message.race === this.raceId && this.phase === 'racing')
        this.race?.receiveInput(connection.slot, message.commands);
    } else {
      if (message.type === 'reject') {
        this.close(message.reason);
        return;
      }
      if (
        message.type === 'lobby' &&
        (this.phase === 'connecting' || this.phase === 'lobby') &&
        message.members.some((m) => m.slot === message.slot)
      ) {
        this.members = message.members;
        this.slot = message.slot;
        this.track = message.track;
        this.pickups = message.pickups;
        this.phase = 'lobby';
        if (message.riding.includes(this.slot) && !this.riding.includes(this.slot))
          this.lastSnapshot = performance.now();
        this.riding = message.riding;
        this.syncPractice();
        this.onChange();
      }
      if (
        message.type === 'prepare' &&
        this.phase === 'lobby' &&
        message.members.some((m) => m.slot === this.slot)
      ) {
        this.raceId = message.race;
        this.members = message.members;
        this.track = message.track;
        this.pickups = message.pickups;
        this.prepare();
        this.send(connection, { type: 'ready', race: this.raceId });
      }
      if (message.type === 'snapshot' && message.race === 0 && this.phase === 'lobby') {
        this.lastSnapshot = performance.now();
        this.practice?.receiveSnapshot(message.state);
      }
      if (message.type === 'snapshot' && message.race === this.raceId && this.race) {
        this.lastSnapshot = performance.now();
        this.race.receiveSnapshot(message.state);
        if (this.phase === 'loading') {
          this.phase = 'racing';
          this.onChange();
        }
        this.members.forEach((m) => (m.connected = !this.race!.disconnected.has(m.slot)));
      }
    }
  }
  setRiding(active: boolean) {
    if (this.phase !== 'lobby') return;
    if (this.host) this.updateRiding(this.slot, active);
    else {
      const host = this.connections.values().next().value;
      if (host) this.send(host, { type: 'ride', active });
    }
  }
  private updateRiding(slot: number, active: boolean) {
    if (this.riding.includes(slot) === active) return;
    this.riding = this.riding.filter((s) => s !== slot);
    if (active) this.riding.push(slot);
    this.publishLobby();
  }
  private syncPractice() {
    if (!this.practice) {
      const practice = new NetworkRace(PRACTICE, this.members, this.slot, this.host);
      this.practice = practice;
      practice.onInput = (commands) => {
        const host = this.connections.values().next().value;
        if (host) this.send(host, { type: 'input', race: 0, commands });
      };
      practice.onSnapshot = (state) => {
        for (const connection of this.connections.values())
          if (connection.slot !== undefined)
            this.send(connection, { type: 'snapshot', race: 0, state }, true);
      };
    }
    this.practice.syncLobby(this.members, this.riding);
  }
  setProfile(name: string, color: number) {
    if (
      this.phase !== 'lobby' ||
      this.riding.includes(this.slot) ||
      !Number.isInteger(color) ||
      color < 0 ||
      color >= COLORS.length
    )
      return;
    const profile = { name: cleanName(name, defaultRacerName(this.slot)), color };
    if (this.host) {
      Object.assign(this.members[0], profile);
      this.publishLobby();
    } else {
      const host = this.connections.values().next().value;
      if (host) this.send(host, { type: 'profile', ...profile });
    }
  }
  setTrack(track: number) {
    if (
      !this.host ||
      this.phase !== 'lobby' ||
      this.riding.includes(this.slot) ||
      !validTrack(track)
    )
      return;
    this.track = track;
    this.publishLobby();
  }
  setPickups(enabled: boolean) {
    if (!this.host || this.phase !== 'lobby' || this.riding.includes(this.slot)) return;
    this.pickups = enabled;
    this.publishLobby();
  }
  private publishLobby() {
    this.riding = this.riding.filter((slot) => this.members.some((m) => m.slot === slot));
    this.syncPractice();
    for (const connection of this.connections.values())
      if (connection.slot !== undefined) {
        this.send(connection, {
          type: 'lobby',
          riding: this.riding,
          members: this.members,
          slot: connection.slot,
          track: this.track,
          pickups: this.pickups,
        });
      }
    this.onChange();
  }
  start() {
    if (!this.host || this.phase !== 'lobby' || this.members.length < 2) return;
    // Incomplete handshakes are not part of the grid.
    for (const connection of this.connections.values())
      if (connection.slot === undefined) this.drop(connection);
    this.raceId++;
    this.phase = 'loading';
    for (const connection of this.connections.values()) {
      connection.ready = false;
      this.send(connection, {
        type: 'prepare',
        race: this.raceId,
        members: this.members,
        track: this.track,
        pickups: this.pickups,
      });
    }
    if (this.phase !== 'loading') return;
    this.prepare();
    this.beginWhenReady();
  }
  private prepare() {
    this.phase = 'loading';
    this.practice = undefined;
    this.riding = [];
    this.since = performance.now();
    const race = new NetworkRace(
      TRACKS[this.track],
      this.members,
      this.slot,
      this.host,
      this.pickups,
    );
    this.race = race;
    race.onInput = (commands) => {
      const host = this.connections.values().next().value;
      if (host) this.send(host, { type: 'input', race: this.raceId, commands });
    };
    race.onSnapshot = (state) => {
      for (const connection of this.connections.values())
        this.send(connection, { type: 'snapshot', race: this.raceId, state }, true);
    };
    this.onRace(race);
    this.onChange();
  }
  private beginWhenReady() {
    if (
      this.phase !== 'loading' ||
      !this.race ||
      [...this.connections.values()].some((c) => !c.ready)
    )
      return;
    this.phase = 'racing';
    this.race.running = true;
    this.race.onSnapshot(this.race.snapshot());
    this.onChange();
  }
  private drop(connection: Connection) {
    if (this.connections.get(connection.channel.peer) !== connection) return;
    this.connections.delete(connection.channel.peer);
    connection.channel.close();
    if (!this.host) {
      this.close('Lost connection to the host. Join a new room to race again.');
      return;
    }
    if (connection.slot !== undefined) {
      if (this.phase === 'lobby')
        this.members = this.members.filter((m) => m.slot !== connection.slot);
      else {
        const member = this.members.find((m) => m.slot === connection.slot);
        if (member) member.connected = false;
        this.race?.disconnect(connection.slot);
      }
    }
    if (this.phase === 'lobby') this.publishLobby();
    else if (this.phase === 'loading')
      this.close('A racer disconnected while loading. Create a new room.');
    else this.onChange();
  }
  private heartbeat() {
    const now = performance.now();
    if ((this.phase === 'connecting' || this.phase === 'loading') && now - this.since > 15000) {
      this.close(
        this.phase === 'loading'
          ? 'A racer did not finish loading. Create a new room.'
          : 'Connection timed out. Check the code or try another network.',
      );
      return;
    }
    if (
      !this.host &&
      (this.phase === 'racing' || (this.phase === 'lobby' && this.riding.includes(this.slot))) &&
      now - this.lastSnapshot > 5000
    ) {
      this.close('The host stopped responding. Join a new room to race again.');
      return;
    }
    // Retry at the heartbeat cadence, preserving data channels during signaling outages.
    if (this.peer?.disconnected && !this.peer.destroyed) this.peer.reconnect();
    for (const connection of this.connections.values()) {
      if (
        now - connection.seen > 6000 ||
        (this.host && connection.slot === undefined && now - connection.opened > 5000)
      )
        this.drop(connection);
      else this.send(connection, { type: 'ping', at: now }, true);
    }
  }
  close(reason?: string) {
    this.generation++;
    clearInterval(this.timer);
    const peer = this.peer;
    this.peer = undefined;
    const connections = [...this.connections.values()];
    this.connections.clear();
    for (const connection of connections) connection.channel.close();
    peer?.destroy();
    this.phase = 'idle';
    this.signalingConnected = false;
    this.race = undefined;
    this.practice = undefined;
    this.riding = [];
    this.members = [];
    this.ping = 0;
    this.onChange();
    if (reason) this.onEnd(reason);
  }
}
