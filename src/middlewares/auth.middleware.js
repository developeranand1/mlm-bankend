// const jwt = require('jsonwebtoken');

// module.exports = (req, res, next) => {
//   const token = req.header('x-auth-token');
  
//   if (!token) {
//     return res.status(401).json({ msg: 'No token, authorization denied' });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded.user;
//     next();
//   } catch (err) {
//     res.status(401).json({ msg: 'Token is not valid' });
//   }
// };

const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  let token = req.header("x-auth-token");

  // Also support Authorization: Bearer <token>
  if (!token && req.header("authorization")) {
    const authHeader = req.header("authorization");
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("JWT DECODED =>", decoded);

    // 🔥 HANDLE ALL POSSIBLE TOKEN STRUCTURES
    if (decoded.user && decoded.user._id) {
      req.user = decoded.user;
    }
    else if (decoded.user && decoded.user.id) {
      req.user = { _id: decoded.user.id };
    }
    else if (decoded.userId) {
      // 🔥 YOUR CASE
      req.user = { _id: decoded.userId };
    }
    else if (decoded.id) {
      req.user = { _id: decoded.id };
    }
    else if (decoded._id) {
      req.user = { _id: decoded._id };
    }
    else {
      return res.status(401).json({ msg: "Invalid token payload" });
    }

    next();
  } catch (err) {
    console.error("JWT ERROR:", err.message);
    return res.status(401).json({ msg: "Token is not valid" });
  }
};



// const jwt = require("jsonwebtoken");

// module.exports = (req, res, next) => {
//   let token = req.header("x-auth-token");

//   // ALSO allow Authorization: Bearer <token>
//   if (!token && req.header("authorization")) {
//     const authHeader = req.header("authorization");
//     if (authHeader.startsWith("Bearer ")) {
//       token = authHeader.split(" ")[1];
//     }
//   }

//   if (!token) {
//     return res.status(401).json({ msg: "No token, authorization denied" });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded.user; // { id, email, etc }
//     next();
//   } catch (err) {
//     return res.status(401).json({ msg: "Token is not valid" });
//   }
// };

