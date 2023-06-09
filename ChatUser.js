"use strict";

/** Functionality related to chatting. */

// Room is an abstraction of a chat channel
const Room = require("./Room");

const axios = require("axios");

const DAD_JOKE_URL = "https://icanhazdadjoke.com/"

/** ChatUser is a individual connection from client -> server to chat. */

class ChatUser {
  /** Make chat user: store connection-device, room.
   *
   * @param send {function} callback to send message to this user
   * @param room {Room} room user will be in
   * */

  constructor(send, roomName) {
    this._send = send; // "send" function for this user
    this.room = Room.get(roomName); // room user will be in
    this.name = null; // becomes the username of the visitor

    console.log(`created chat in ${this.room.name}`);
  }

  /** Send msgs to this client using underlying connection-send-function.
   *
   * @param data {string} message to send
   * */

  send(data) {
    try {
      this._send(data);
    } catch {
      // If trying to send to a user fails, ignore it
    }
  }

  /** Handle joining: add to room members, announce join.
   *
   * @param name {string} name to use in room
   * */

  handleJoin(name) {
    this.name = name;
    this.room.join(this);
    this.room.broadcast({
      type: "note",
      text: `${this.name} joined "${this.room.name}".`,
    });
  }

  /** Handle a chat: broadcast to room.
   *
   * @param text {string} message to send
   * */

  handleChat(text) {
    this.room.broadcast({
      name: this.name,
      type: "chat",
      text: text,
    });
  }

  /** Handle messages from client:
   *
   * @param jsonData {string} raw message data
   *
   * @example<code>
   * - {type: "join", name: username} : join
   * - {type: "chat", text: msg }     : chat
   * </code>
   */

  async handleMessage(jsonData) {
    let msg = JSON.parse(jsonData);

    if (msg.type === "join") {
      this.handleJoin(msg.name);
    } else if (msg.type === "chat") {
      if (msg.text === "/joke") {
        await this.handleJoke();
      } else if (msg.text === "/members") {
        this.handleMembers();
      } else {
        this.handleChat(msg.text);
      }
    } else {
      throw new Error(`bad message: ${msg.type}`);
    }
  }

  /** Handle a joke request: only send to user that requested joke. */

  async handleJoke() {
    let response = await axios({
      method: 'get',
      url: DAD_JOKE_URL,
      headers: {
        'Accept': 'text/plain'
      }
    });
    let joke = {
      name: this.name,
      type: "chat",
      text: response.data
    };

    this.send(JSON.stringify(joke));
  }

  /** Handle a member list request: only send to user that requested members. */

  handleMembers() {
    let roomMems = [];
    this.room.members.forEach(member => {
      roomMems.push(member.name);
    });

    let chatMembers = `In room: ${roomMems.join(', ')}`;

    let membersMessage = {
      name: this.name,
      type: "chat",
      text: chatMembers
    };

    this.send(JSON.stringify(membersMessage));
  }


  /** Connection was closed: leave room, announce exit to others. */

  handleClose() {
    this.room.leave(this);
    this.room.broadcast({
      type: "note",
      text: `${this.name} left ${this.room.name}.`,
    });
  }
}

module.exports = ChatUser;
