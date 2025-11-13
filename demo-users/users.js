const { image1, image2, image3, image4, image5, image6, image7, image8, image9, image10 } = require("./image");

const users = [
    {
        "cmd": "setuserinfo",
        "admin": 0,
        "enrollid": 1001,
        "name": "Wick Jhon 1",
        modes: [
            {
                "backupnum": 50,
                "record": image1
            },
            {
                "backupnum": 10,
                "record": 12345678
            },
            {
                "backupnum": 11,
                "record": 12345678
            }]
    },
    // {
    //     "cmd": "setuserinfo",
    //     "admin": 0,
    //     "enrollid": 1002,
    //     "name": "Wick Jhon 2",
    //     modes: [
    //         {
    //             "backupnum": 50,
    //             "record": image2
    //         },
    //         {
    //             "backupnum": 10,
    //             "record": 12345678
    //         },
    //         {
    //             "backupnum": 11,
    //             "record": 12345678
    //         }]
    // },
    // {
    //     "cmd": "setuserinfo",
    //     "admin": 0,
    //     "enrollid": 1003,
    //     "name": "Wick Jhon 3",
    //     modes: [
    //         {
    //             "backupnum": 50,
    //             "record": image3
    //         },
    //         {
    //             "backupnum": 10,
    //             "record": 12345678
    //         },
    //         {
    //             "backupnum": 11,
    //             "record": 12345678
    //         }]
    // },
    // {
    //     "cmd": "setuserinfo",
    //     "admin": 0,
    //     "enrollid": 1004,
    //     "name": "Wick Jhon 4",
    //     modes: [
    //         {
    //             "backupnum": 50,
    //             "record": image4
    //         },
    //         {
    //             "backupnum": 10,
    //             "record": 12345678
    //         },
    //         {
    //             "backupnum": 11,
    //             "record": 12345678
    //         }]
    // },
    // {
    //     "cmd": "setuserinfo",
    //     "admin": 0,
    //     "enrollid": 1005,
    //     "name": "Wick Jhon 5",
    //     modes: [
    //         {
    //             "backupnum": 50,
    //             "record": image5
    //         },
    //         {
    //             "backupnum": 10,
    //             "record": 12345678
    //         },
    //         {
    //             "backupnum": 11,
    //             "record": 12345678
    //         }]
    // },
    // {
    //     "cmd": "setuserinfo",
    //     "admin": 0,
    //     "enrollid": 1006,
    //     "name": "Wick Jhon 6",
    //     modes: [
    //         {
    //             "backupnum": 50,
    //             "record": image6
    //         },
    //         {
    //             "backupnum": 10,
    //             "record": 12345678
    //         },
    //         {
    //             "backupnum": 11,
    //             "record": 12345678
    //         }]
    // },
    // {
    //     "cmd": "setuserinfo",
    //     "admin": 0,
    //     "enrollid": 1007,
    //     "name": "Wick Jhon 7",
    //     modes: [
    //         {
    //             "backupnum": 50,
    //             "record": image7
    //         },
    //         {
    //             "backupnum": 10,
    //             "record": 12345678
    //         },
    //         {
    //             "backupnum": 11,
    //             "record": 12345678
    //         }]
    // },
    // {
    //     "cmd": "setuserinfo",
    //     "admin": 0,
    //     "enrollid": 1008,
    //     "name": "Wick Jhon 8",
    //     modes: [
    //         {
    //             "backupnum": 50,
    //             "record": image8
    //         },
    //         {
    //             "backupnum": 10,
    //             "record": 12345678
    //         },
    //         {
    //             "backupnum": 11,
    //             "record": 12345678
    //         }]
    // },
    // {
    //     "cmd": "setuserinfo",
    //     "admin": 0,
    //     "enrollid": 1009,
    //     "name": "Wick Jhon 9",
    //     modes: [
    //         {
    //             "backupnum": 50,
    //             "record": image9
    //         },
    //         {
    //             "backupnum": 10,
    //             "record": 12345678
    //         },
    //         {
    //             "backupnum": 11,
    //             "record": 12345678
    //         }]
    // },
    // {
    //     "cmd": "setuserinfo",
    //     "admin": 0,
    //     "enrollid": 1010,
    //     "name": "Wick Jhon 10",
    //     modes: [
    //         {
    //             "backupnum": 50,
    //             "record": image10
    //         },
    //         {
    //             "backupnum": 10,
    //             "record": 12345678
    //         },
    //         {
    //             "backupnum": 11,
    //             "record": 12345678
    //         }]
    // }
];

module.exports = { users }