/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/gamegambit.json`.
 */
export type Gamegambit = {
  "address": "E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR",
  "metadata": {
    "name": "gamegambit",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Game Gambit — on-chain chess wager program"
  },
  "instructions": [
    {
      "name": "banPlayer",
      "discriminator": [
        20,
        123,
        183,
        191,
        29,
        55,
        244,
        21
      ],
      "accounts": [
        {
          "name": "playerProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "player_profile.player",
                "account": "playerProfile"
              }
            ]
          }
        },
        {
          "name": "authorizer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "banDuration",
          "type": "i64"
        }
      ]
    },
    {
      "name": "closeWager",
      "discriminator": [
        167,
        240,
        85,
        147,
        127,
        50,
        69,
        203
      ],
      "accounts": [
        {
          "name": "wager",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  103,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "wager.player_a",
                "account": "wagerAccount"
              },
              {
                "kind": "account",
                "path": "wager.match_id",
                "account": "wagerAccount"
              }
            ]
          }
        },
        {
          "name": "playerA",
          "writable": true
        },
        {
          "name": "playerB",
          "writable": true
        },
        {
          "name": "authorizer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createWager",
      "discriminator": [
        210,
        82,
        178,
        75,
        253,
        34,
        84,
        120
      ],
      "accounts": [
        {
          "name": "wager",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  103,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "playerA"
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "playerAProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "playerA"
              }
            ]
          }
        },
        {
          "name": "playerA",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "matchId",
          "type": "u64"
        },
        {
          "name": "stakeLamports",
          "type": "u64"
        },
        {
          "name": "lichessGameId",
          "type": "string"
        },
        {
          "name": "requiresModerator",
          "type": "bool"
        }
      ]
    },
    {
      "name": "initializePlayer",
      "discriminator": [
        79,
        249,
        88,
        177,
        220,
        62,
        56,
        128
      ],
      "accounts": [
        {
          "name": "playerProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "joinWager",
      "discriminator": [
        119,
        81,
        120,
        160,
        80,
        8,
        75,
        239
      ],
      "accounts": [
        {
          "name": "wager",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  103,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "wager.player_a",
                "account": "wagerAccount"
              },
              {
                "kind": "account",
                "path": "wager.match_id",
                "account": "wagerAccount"
              }
            ]
          }
        },
        {
          "name": "playerBProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "playerB"
              }
            ]
          }
        },
        {
          "name": "playerB",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "stakeLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resolveWager",
      "discriminator": [
        31,
        179,
        1,
        228,
        83,
        224,
        1,
        123
      ],
      "accounts": [
        {
          "name": "wager",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  103,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "wager.player_a",
                "account": "wagerAccount"
              },
              {
                "kind": "account",
                "path": "wager.match_id",
                "account": "wagerAccount"
              }
            ]
          }
        },
        {
          "name": "winner",
          "writable": true
        },
        {
          "name": "authorizer",
          "writable": true,
          "signer": true
        },
        {
          "name": "platformWallet",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "winner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "retractVote",
      "discriminator": [
        227,
        0,
        85,
        234,
        243,
        42,
        133,
        162
      ],
      "accounts": [
        {
          "name": "wager",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  103,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "wager.player_a",
                "account": "wagerAccount"
              },
              {
                "kind": "account",
                "path": "wager.match_id",
                "account": "wagerAccount"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "submitVote",
      "discriminator": [
        115,
        242,
        100,
        0,
        49,
        178,
        242,
        133
      ],
      "accounts": [
        {
          "name": "wager",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  103,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "wager.player_a",
                "account": "wagerAccount"
              },
              {
                "kind": "account",
                "path": "wager.match_id",
                "account": "wagerAccount"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "votedWinner",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "playerProfile",
      "discriminator": [
        82,
        226,
        99,
        87,
        164,
        130,
        181,
        80
      ]
    },
    {
      "name": "wagerAccount",
      "discriminator": [
        43,
        206,
        233,
        140,
        104,
        50,
        20,
        243
      ]
    }
  ],
  "events": [
    {
      "name": "playerBanned",
      "discriminator": [
        164,
        0,
        117,
        147,
        4,
        138,
        149,
        196
      ]
    },
    {
      "name": "voteRetracted",
      "discriminator": [
        48,
        194,
        255,
        216,
        156,
        13,
        121,
        241
      ]
    },
    {
      "name": "voteSubmitted",
      "discriminator": [
        21,
        54,
        43,
        190,
        87,
        214,
        250,
        218
      ]
    },
    {
      "name": "wagerClosed",
      "discriminator": [
        157,
        212,
        28,
        112,
        6,
        143,
        187,
        185
      ]
    },
    {
      "name": "wagerCreated",
      "discriminator": [
        177,
        41,
        34,
        111,
        170,
        96,
        157,
        62
      ]
    },
    {
      "name": "wagerJoined",
      "discriminator": [
        74,
        213,
        37,
        114,
        201,
        144,
        6,
        12
      ]
    },
    {
      "name": "wagerResolved",
      "discriminator": [
        166,
        83,
        14,
        127,
        130,
        175,
        204,
        13
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidStatus",
      "msg": "Invalid wager status"
    },
    {
      "code": 6001,
      "name": "unauthorized",
      "msg": "Unauthorized access"
    },
    {
      "code": 6002,
      "name": "retractPeriodNotExpired",
      "msg": "Retract period has not expired yet"
    },
    {
      "code": 6003,
      "name": "retractExpired",
      "msg": "Retract period expired"
    },
    {
      "code": 6004,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6005,
      "name": "invalidMatchId",
      "msg": "Invalid match ID"
    },
    {
      "code": 6006,
      "name": "lichessGameIdTooLong",
      "msg": "Lichess game ID too long"
    },
    {
      "code": 6007,
      "name": "invalidVote",
      "msg": "Invalid vote"
    },
    {
      "code": 6008,
      "name": "alreadyVoted",
      "msg": "Already voted"
    },
    {
      "code": 6009,
      "name": "invalidWinner",
      "msg": "Invalid winner"
    },
    {
      "code": 6010,
      "name": "invalidPlayer",
      "msg": "Invalid player"
    },
    {
      "code": 6011,
      "name": "playerBanned",
      "msg": "Player is banned"
    },
    {
      "code": 6012,
      "name": "wagerExpired",
      "msg": "Wager has expired"
    },
    {
      "code": 6013,
      "name": "invalidPlatformWallet",
      "msg": "Invalid platform wallet"
    },
    {
      "code": 6014,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6015,
      "name": "insufficientFunds",
      "msg": "Insufficient funds in wager account"
    }
  ],
  "types": [
    {
      "name": "playerBanned",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "isBanned",
            "type": "bool"
          },
          {
            "name": "banExpiresAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "playerProfile",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "isBanned",
            "type": "bool"
          },
          {
            "name": "banExpiresAt",
            "type": "i64"
          },
          {
            "name": "lastActive",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "voteRetracted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wagerId",
            "type": "pubkey"
          },
          {
            "name": "player",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "voteSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wagerId",
            "type": "pubkey"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "votedWinner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "wagerAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "playerA",
            "type": "pubkey"
          },
          {
            "name": "playerB",
            "type": "pubkey"
          },
          {
            "name": "matchId",
            "type": "u64"
          },
          {
            "name": "stakeLamports",
            "type": "u64"
          },
          {
            "name": "lichessGameId",
            "type": "string"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "wagerStatus"
              }
            }
          },
          {
            "name": "requiresModerator",
            "type": "bool"
          },
          {
            "name": "votePlayerA",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "votePlayerB",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "winner",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "voteTimestamp",
            "type": "i64"
          },
          {
            "name": "retractDeadline",
            "type": "i64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "resolvedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "wagerClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wagerId",
            "type": "pubkey"
          },
          {
            "name": "closedBy",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "wagerCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wagerId",
            "type": "pubkey"
          },
          {
            "name": "playerA",
            "type": "pubkey"
          },
          {
            "name": "matchId",
            "type": "u64"
          },
          {
            "name": "stakeLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "wagerJoined",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wagerId",
            "type": "pubkey"
          },
          {
            "name": "playerB",
            "type": "pubkey"
          },
          {
            "name": "stakeLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "wagerResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wagerId",
            "type": "pubkey"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "playerA",
            "type": "pubkey"
          },
          {
            "name": "playerB",
            "type": "pubkey"
          },
          {
            "name": "totalPayout",
            "type": "u64"
          },
          {
            "name": "platformFee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "wagerStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "created"
          },
          {
            "name": "joined"
          },
          {
            "name": "voting"
          },
          {
            "name": "retractable"
          },
          {
            "name": "disputed"
          },
          {
            "name": "closed"
          },
          {
            "name": "resolved"
          }
        ]
      }
    }
  ]
};
