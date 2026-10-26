// Approved default appearance only. Other outfits retain their own fallback.
// PNG bytes are copied unchanged from the user-approved running/claw v2 package.
window.MACH_ATTACK_ASSETS = Object.freeze({
  "default": {
    "schema": "layered-v1",
    "appearanceId": "default",
    "approvalReference": "user-approved-hanyangyi-running-claw-v2",
    "frameWidth": 128,
    "frameHeight": 96,
    "frameCount": 8,
    "durationsMs": [
      50,
      50,
      40,
      45,
      45,
      50,
      60,
      60
    ],
    "runStridePx": 132,
    "directions": {
      "right": {
        "pivot": {
          "x": 40,
          "y": 88
        },
        "waistAnchor": {
          "x": 40,
          "y": 78
        },
        "upper_offset_y": [
          0,
          -1,
          -2,
          -1,
          0,
          -1,
          -2,
          -1
        ],
        "air_upper_offset_y": [
          -1,
          0
        ],
        "lowerAirFrames": 2,
        "hitBounds": {
          "left": 33,
          "top": -35,
          "right": 49,
          "bottom": -17
        },
        "upperNeutral": "assets/hanyangyi-running-v2/upper-neutral-right.png",
        "upperAttack": "assets/hanyangyi-running-v2/upper-attack-right.png",
        "lowerIdle": "assets/hanyangyi-running-v2/lower-idle-right.png",
        "lowerRun": "assets/hanyangyi-running-v2/lower-run-right.png",
        "clawSheet": "assets/hanyangyi-running-v2/claws-right.png",
        "fullNeutral": "assets/hanyangyi-running-v2/full-neutral-right.png",
        "lowerAir": [
          "assets/hanyangyi-running-v2/lower-air-right-0.png",
          "assets/hanyangyi-running-v2/lower-air-right-1.png"
        ]
      },
      "left": {
        "pivot": {
          "x": 88,
          "y": 88
        },
        "waistAnchor": {
          "x": 88,
          "y": 78
        },
        "upper_offset_y": [
          0,
          -1,
          -2,
          -1,
          0,
          -1,
          -2,
          -1
        ],
        "air_upper_offset_y": [
          -1,
          0
        ],
        "lowerAirFrames": 2,
        "hitBounds": {
          "left": -49,
          "top": -35,
          "right": -33,
          "bottom": -17
        },
        "upperNeutral": "assets/hanyangyi-running-v2/upper-neutral-left.png",
        "upperAttack": "assets/hanyangyi-running-v2/upper-attack-left.png",
        "lowerIdle": "assets/hanyangyi-running-v2/lower-idle-left.png",
        "lowerRun": "assets/hanyangyi-running-v2/lower-run-left.png",
        "clawSheet": "assets/hanyangyi-running-v2/claws-left.png",
        "fullNeutral": "assets/hanyangyi-running-v2/full-neutral-left.png",
        "lowerAir": [
          "assets/hanyangyi-running-v2/lower-air-left-0.png",
          "assets/hanyangyi-running-v2/lower-air-left-1.png"
        ]
      }
    }
  }
});
