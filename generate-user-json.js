const fs = require('fs');
const { users } = require('./demo-users/users');

fs.writeFile('users.json', JSON.stringify(users, null, 2), (err) => {
    if (err) {
        console.error('Error writing file', err);
    } else {
        console.log('Users saved to users.json');
    }
});