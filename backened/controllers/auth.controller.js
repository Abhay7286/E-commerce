import redis from "../lib/redis.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

const generateToken = (userid) => {
    const accessToken = jwt.sign({userid}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: "15m"});
    const refreshToken = jwt.sign({userid}, process.env.REFRESH_TOKEN_SECRET, {expiresIn: "7d"});

    return {accessToken, refreshToken};
}

const storeRefreshToken  = async (userId,refreshToken) => {
    await redis.set(`refresh_token:${userId.toString()}`, refreshToken,"EX", 7 * 24 * 60 * 60); //7 days
    console.log(`Stored refresh token for userId ${userId}: ${refreshToken}`);
}

const setCookies = (res, accessToken, refreshToken) => {
    res.cookie("accessToken", accessToken,{
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000, //15 minutes
    });
    res.cookie("refreshToken", refreshToken,{
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, //7 days
    });
}

export const signup = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({ name, email, password });

    //authentication
    const {accessToken, refreshToken} = generateToken(user._id);
    await storeRefreshToken(user._id, refreshToken);
    setCookies(res, accessToken, refreshToken);

    // const storedTokenCheck = await redis.get(`refresh_token:${user._id}`);
    // console.log(`Stored Token Check: ${storedTokenCheck}`); 

    res.status(201).json({ user:{
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
    }, message: "User created successfully" });
  } catch (error) {
    console.log("error in signup controller", error.message);
    res.status(500).json({message: error.message});
  }
};
export const login = async (req, res) => {
    try {
        const {email,password} = req.body;

        const user = await User.findOne({email});
        
        if(user && await user.comparePassword(password)){
            const {accessToken, refreshToken} = generateToken(user._id);
            await storeRefreshToken(user._id, refreshToken);
            setCookies(res, accessToken, refreshToken);

            res.status(200).json({user:{
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            },message:"user logged in successfully"});
        }else{
            res.status(401).json({message:"Invalid credentials"});
        }

    } catch (error) {
        console.log("error in login controller", error.message);
        res.status(500).json({message: error.message});
    }
};
export const logout = async (req, res) => {
   try {
    const refreshToken = req.cookies.refreshToken;

    if(refreshToken){
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        await redis.del(`refresh_token:${decoded.userId}`);
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res.json({message: "User logged out successfully"});
   } catch (error) {
    console.log("error in logout controller", error.message);
    res.status(500).json({message: error.message});
   }
};


export const refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ message: "No refresh token provided" });
        }

        // Decode the token
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

        // console.log(`Decoded userId from refresh token: ${decoded.userid}`); 

        // Retrieve the stored refresh token from Redis
        const storedToken = await redis.get(`refresh_token:${decoded.userid}`);
        // console.log(`Stored token: ${storedToken}`); 

        if (!storedToken) {
            console.log("Stored token is null. Possible expiry or Redis issue.");
            return res.status(401).json({ message: "Invalid refresh token" });
        }

        // Compare the tokens
        if (storedToken !== refreshToken) {
            return res.status(401).json({ message: "Invalid refresh token" });
        }

        // Generate new access token
        const accessToken = jwt.sign(
            { userId: decoded.userid },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: "15m" }
        );

        // Set new access token in cookies
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 15 * 60 * 1000, // 15 minutes
        });

        res.json({ message: "Token refreshed successfully" });
    } catch (error) {
        console.log("Error in refreshToken controller", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const getProfile = async (req, res) => {
    try {
        res.json(req.user);
    } catch (error) {
        console.log("error in getProfile controller", error.message);
        res.status(500).json({ message: error.message });        
    }
}