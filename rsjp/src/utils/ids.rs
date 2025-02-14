/// Create a newtype that will contain an index represented by an integer.
#[macro_export]
macro_rules! define_id_type {
    ($name: ident, $type: ident) => {
        #[derive(
            ::std::marker::Copy,
            ::std::clone::Clone,
            ::std::default::Default,
            ::std::fmt::Debug,
            ::std::hash::Hash,
            ::serde::Serialize,
            ::serde::Deserialize,
            ::std::cmp::Ord,
            ::std::cmp::PartialOrd,
            ::std::cmp::Eq,
            ::std::cmp::PartialEq,
        )]
        pub struct $name($type);

        impl $name {
            #[inline]
            pub fn new(value: $type) -> Self {
                Self(value)
            }

            #[inline]
            pub fn as_num(&self) -> $type {
                self.0 as $type
            }

            #[inline]
            pub fn as_usize(&self) -> usize {
                self.0 as usize
            }
        }

        impl $crate::ItemId for $name {
            type IdType = $type;
        }

        impl ::std::convert::From<$type> for $name {
            #[inline]
            fn from(value: $type) -> Self {
                Self::new(value)
            }
        }

        impl ::std::convert::From<$name> for $type {
            #[inline]
            fn from(id: $name) -> Self {
                id.0
            }
        }

        impl ::std::convert::From<$name> for usize {
            #[inline]
            fn from(id: $name) -> Self {
                id.0 as usize
            }
        }

        impl ::std::fmt::Display for $name {
            #[inline]
            fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
                self.0.fmt(f)
            }
        }

        impl ::std::str::FromStr for $name {
            type Err = ::std::num::ParseIntError;

            fn from_str(s: &str) -> ::std::result::Result<Self, Self::Err> {
                Ok($name(s.parse::<$type>()?))
            }
        }

        impl $crate::AsIdVec<$name> for ::std::vec::Vec<$type> {
            #[inline]
            fn to_ids(self) -> ::std::vec::Vec<$name> {
                self.into_iter().map(|id| id.into()).collect()
            }
        }
    };
}

/// Represents a newtype ID defined by `define_id_type`.
pub trait ItemId {
    /// Returns the inner type of the ID.
    type IdType;
}

/// Converts a vector of integers into a vector of a corresponding newtype index
pub trait AsIdVec<IdType: ItemId> {
    fn to_ids(self) -> Vec<IdType>;
}
